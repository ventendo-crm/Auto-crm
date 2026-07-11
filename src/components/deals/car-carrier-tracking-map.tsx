"use client";

import { useEffect, useRef } from "react";
import { MediaType } from "@prisma/client";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { CarCarrierDestination, CarCarrierTrackingPoint } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildPointPopup(point: CarCarrierTrackingPoint, index: number) {
  const title = escapeHtml(point.title.trim() || `Точка ${index + 1}`);
  const date = escapeHtml(formatDate(point.recordedAt));
  const description = point.description
    ? `<p style="margin:8px 0 0;font-size:13px;line-height:1.45;white-space:pre-wrap;">${escapeHtml(point.description)}</p>`
    : "";

  const photos =
    point.media.length > 0
      ? `<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-top:10px;">
          ${point.media
            .map((item) => {
              const src = escapeHtml(item.thumbnailUrl ?? item.fileUrl);
              const href = escapeHtml(item.fileUrl);
              return `<a href="${href}" target="_blank" rel="noopener noreferrer" style="display:block;overflow:hidden;border-radius:8px;border:1px solid #e5e7eb;">
                <img src="${src}" alt="" style="display:block;width:100%;aspect-ratio:1;object-fit:cover;" />
              </a>`;
            })
            .join("")}
        </div>`
      : "";

  return `<div style="min-width:180px;max-width:280px;">
    <p style="margin:0;font-size:14px;font-weight:600;">${title}</p>
    <p style="margin:4px 0 0;font-size:12px;color:#6b7280;">${date}</p>
    ${description}
    ${photos}
  </div>`;
}

const ROUTE_COLOR = "#dc2626";
const DESTINATION_ROUTE_COLOR = "#16a34a";

const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const selectedIcon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const destinationIcon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const searchPreviewIcon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const DEFAULT_CENTER: L.LatLngExpression = [55.7558, 37.6173];
const DEFAULT_ZOOM = 4;

function getPointPreviewMedia(point: CarCarrierTrackingPoint) {
  const photos = point.media.filter((item) => item.type === MediaType.PHOTO);
  if (photos.length > 0) {
    return photos[photos.length - 1];
  }
  return point.media[point.media.length - 1] ?? null;
}

function createPointMarkerIcon(point: CarCarrierTrackingPoint, isSelected: boolean) {
  const previewMedia = getPointPreviewMedia(point);
  const previewUrl = previewMedia?.thumbnailUrl ?? previewMedia?.fileUrl;

  if (!previewUrl) {
    return isSelected ? selectedIcon : defaultIcon;
  }

  const borderColor = isSelected ? "#f97316" : "#ffffff";
  const countBadge =
    point.media.length > 1
      ? `<span style="position:absolute;top:-4px;right:-4px;min-width:16px;height:16px;padding:0 4px;border-radius:9999px;background:#dc2626;color:#fff;font-size:10px;font-weight:600;line-height:16px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,0.3);">${point.media.length}</span>`
      : "";

  return L.divIcon({
    className: "car-carrier-photo-marker",
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;pointer-events:none;">
        <div style="position:relative;width:44px;height:44px;border:2px solid ${borderColor};border-radius:10px;overflow:hidden;background:#fff;box-shadow:0 2px 10px rgba(0,0,0,0.28);">
          <img src="${previewUrl}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;" />
          ${countBadge}
        </div>
        <div style="width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:8px solid ${borderColor};margin-top:-1px;"></div>
        <div style="width:10px;height:10px;border-radius:9999px;background:#dc2626;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.25);"></div>
      </div>
    `,
    iconSize: [52, 66],
    iconAnchor: [26, 66],
    tooltipAnchor: [0, -58],
  });
}

export type CarCarrierMapMode = "tracking" | "destination" | false;

export interface MapViewTarget {
  latitude: number;
  longitude: number;
  zoom?: number;
  key?: number;
}

export interface MapSearchPreview {
  latitude: number;
  longitude: number;
  label: string;
}

interface CarCarrierTrackingMapProps {
  points: CarCarrierTrackingPoint[];
  destination?: CarCarrierDestination | null;
  selectedPointId?: string | null;
  canAddPoints?: boolean;
  addMode?: CarCarrierMapMode;
  viewTarget?: MapViewTarget | null;
  searchPreview?: MapSearchPreview | null;
  autoFitBounds?: boolean;
  showPointPopups?: boolean;
  onMapClick?: (latitude: number, longitude: number) => void;
  onPointSelect?: (pointId: string) => void;
  className?: string;
}

export function CarCarrierTrackingMap({
  points,
  destination,
  selectedPointId,
  canAddPoints = false,
  addMode = false,
  viewTarget,
  searchPreview,
  autoFitBounds = true,
  showPointPopups = false,
  onMapClick,
  onPointSelect,
  className,
}: CarCarrierTrackingMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routeRef = useRef<L.Polyline | null>(null);
  const destinationRouteRef = useRef<L.Polyline | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      scrollWheelZoom: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markersLayerRef.current = null;
      routeRef.current = null;
      destinationRouteRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    if (routeRef.current) {
      routeRef.current.remove();
      routeRef.current = null;
    }
    if (destinationRouteRef.current) {
      destinationRouteRef.current.remove();
      destinationRouteRef.current = null;
    }

    const trackingLatLngs: L.LatLngExpression[] = [];

    points.forEach((point, index) => {
      const latLng: L.LatLngExpression = [point.latitude, point.longitude];
      trackingLatLngs.push(latLng);

      const marker = L.marker(latLng, {
        icon: createPointMarkerIcon(point, point.id === selectedPointId),
      });

      const label = point.title.trim() || `Точка ${index + 1}`;
      const tooltipOffset = point.media.length > 0 ? [0, -58] : [0, -36];
      marker.bindTooltip(label, { direction: "top", offset: tooltipOffset as L.PointExpression });

      if (showPointPopups) {
        marker.bindPopup(buildPointPopup(point, index), { maxWidth: 300 });
        marker.on("click", () => {
          marker.openPopup();
        });
      } else {
        marker.on("click", () => {
          onPointSelect?.(point.id);
        });
      }

      layer.addLayer(marker);
    });

    const boundsPoints: L.LatLngExpression[] = [...trackingLatLngs];

    if (destination) {
      const destLatLng: L.LatLngExpression = [destination.latitude, destination.longitude];
      boundsPoints.push(destLatLng);

      const destMarker = L.marker(destLatLng, { icon: destinationIcon });
      destMarker.bindTooltip(destination.title || "Точка назначения", {
        direction: "top",
        offset: [0, -36],
      });
      if (showPointPopups) {
        destMarker.bindPopup(
          `<div style="min-width:160px;">
            <p style="margin:0;font-size:14px;font-weight:600;">${escapeHtml(destination.title || "Точка назначения")}</p>
            <p style="margin:4px 0 0;font-size:12px;color:#6b7280;">Финальная точка назначения</p>
          </div>`,
          { maxWidth: 260 },
        );
      }
      layer.addLayer(destMarker);
    }

    if (searchPreview) {
      const previewLatLng: L.LatLngExpression = [
        searchPreview.latitude,
        searchPreview.longitude,
      ];
      const previewMarker = L.marker(previewLatLng, { icon: searchPreviewIcon });
      previewMarker.bindTooltip(searchPreview.label, {
        direction: "top",
        offset: [0, -36],
      });
      layer.addLayer(previewMarker);
    }

    if (trackingLatLngs.length >= 2) {
      routeRef.current = L.polyline(trackingLatLngs, {
        color: ROUTE_COLOR,
        weight: 4,
        opacity: 0.9,
      }).addTo(map);
    }

    if (destination && trackingLatLngs.length >= 1) {
      const lastPoint = trackingLatLngs[trackingLatLngs.length - 1];
      destinationRouteRef.current = L.polyline(
        [lastPoint, [destination.latitude, destination.longitude]],
        {
          color: DESTINATION_ROUTE_COLOR,
          weight: 4,
          opacity: 0.9,
        },
      ).addTo(map);
    }

    if (autoFitBounds) {
      if (boundsPoints.length === 1) {
        map.setView(boundsPoints[0], 10, { animate: true });
      } else if (boundsPoints.length > 1) {
        map.fitBounds(L.latLngBounds(boundsPoints), {
          padding: [40, 40],
          maxZoom: 12,
          animate: true,
        });
      }
    }
  }, [points, destination, selectedPointId, searchPreview, autoFitBounds, showPointPopups, onPointSelect]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !viewTarget) return;

    map.flyTo([viewTarget.latitude, viewTarget.longitude], viewTarget.zoom ?? 10, {
      animate: true,
      duration: 0.8,
    });
  }, [viewTarget?.latitude, viewTarget?.longitude, viewTarget?.zoom, viewTarget?.key]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleClick = (event: L.LeafletMouseEvent) => {
      if (!canAddPoints || !addMode) return;
      onMapClick?.(event.latlng.lat, event.latlng.lng);
    };

    if (canAddPoints && addMode) {
      map.on("click", handleClick);
      if (containerRef.current) {
        containerRef.current.style.cursor = "crosshair";
      }
    } else {
      map.off("click", handleClick);
      if (containerRef.current) {
        containerRef.current.style.cursor = "";
      }
    }

    return () => {
      map.off("click", handleClick);
    };
  }, [canAddPoints, addMode, onMapClick]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const timer = setTimeout(() => map.invalidateSize(), 100);
    return () => clearTimeout(timer);
  }, [points.length, destination, addMode]);

  return (
    <div
      ref={containerRef}
      className={cn("z-0 h-[min(50vh,420px)] w-full rounded-lg border bg-muted/20", className)}
    />
  );
}
