"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { CarCarrierDestination, CarCarrierTrackingPoint } from "@/lib/types";
import { cn } from "@/lib/utils";

const ROUTE_COLOR = "#dc2626";

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
  onMapClick,
  onPointSelect,
  className,
}: CarCarrierTrackingMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routeRef = useRef<L.Polyline | null>(null);

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

    const routeLatLngs: L.LatLngExpression[] = [];

    points.forEach((point, index) => {
      const latLng: L.LatLngExpression = [point.latitude, point.longitude];
      routeLatLngs.push(latLng);

      const marker = L.marker(latLng, {
        icon: point.id === selectedPointId ? selectedIcon : defaultIcon,
      });

      const label = point.title.trim() || `Точка ${index + 1}`;
      marker.bindTooltip(label, { direction: "top", offset: [0, -36] });

      marker.on("click", () => {
        onPointSelect?.(point.id);
      });

      layer.addLayer(marker);
    });

    const boundsPoints: L.LatLngExpression[] = [...routeLatLngs];

    if (destination) {
      const destLatLng: L.LatLngExpression = [destination.latitude, destination.longitude];
      routeLatLngs.push(destLatLng);
      boundsPoints.push(destLatLng);

      const destMarker = L.marker(destLatLng, { icon: destinationIcon });
      destMarker.bindTooltip(destination.title || "Точка назначения", {
        direction: "top",
        offset: [0, -36],
      });
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

    if (routeLatLngs.length >= 2) {
      routeRef.current = L.polyline(routeLatLngs, {
        color: ROUTE_COLOR,
        weight: 4,
        opacity: 0.9,
      }).addTo(map);
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
  }, [points, destination, selectedPointId, searchPreview, autoFitBounds, onPointSelect]);

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
