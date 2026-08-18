"use client";

import { Minus, Plus, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const ZOOM_STEP = 0.35;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function pinchDistance(a: { clientX: number; clientY: number }, b: { clientX: number; clientY: number }) {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

interface ZoomableImageProps {
  src: string;
  alt: string;
}

export function ZoomableImage({ src, alt }: ZoomableImageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ pointerId: number; x: number; y: number; ox: number; oy: number } | null>(
    null,
  );
  const pinchRef = useRef<{
    distance: number;
    scale: number;
    offset: { x: number; y: number };
  } | null>(null);
  const scaleRef = useRef(scale);
  const offsetRef = useRef(offset);

  scaleRef.current = scale;
  offsetRef.current = offset;

  const reset = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
    dragRef.current = null;
    pinchRef.current = null;
    setDragging(false);
  }, []);

  useEffect(() => {
    reset();
  }, [src, reset]);

  const zoomAt = useCallback((nextScale: number, clientX?: number, clientY?: number) => {
    const currentScale = scaleRef.current;
    const next = clamp(nextScale, MIN_SCALE, MAX_SCALE);
    if (next === 1) {
      setScale(1);
      setOffset({ x: 0, y: 0 });
      return;
    }

    const container = containerRef.current;
    if (!container || clientX == null || clientY == null) {
      setScale(next);
      return;
    }

    const rect = container.getBoundingClientRect();
    const pointX = clientX - rect.left - rect.width / 2;
    const pointY = clientY - rect.top - rect.height / 2;
    const ratio = next / currentScale;
    const currentOffset = offsetRef.current;

    setScale(next);
    setOffset({
      x: pointX - (pointX - currentOffset.x) * ratio,
      y: pointY - (pointY - currentOffset.y) * ratio,
    });
  }, []);

  const zoomBy = useCallback(
    (delta: number, clientX?: number, clientY?: number) => {
      zoomAt(scaleRef.current + delta, clientX, clientY);
    },
    [zoomAt],
  );

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const step = event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
      zoomBy(step, event.clientX, event.clientY);
    };

    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length < 2 && scaleRef.current <= 1) return;
      event.preventDefault();

      if (event.touches.length === 2 && pinchRef.current) {
        const distance = pinchDistance(event.touches[0], event.touches[1]);
        const start = pinchRef.current;
        const next = clamp(start.scale * (distance / start.distance), MIN_SCALE, MAX_SCALE);
        const midX = (event.touches[0].clientX + event.touches[1].clientX) / 2;
        const midY = (event.touches[0].clientY + event.touches[1].clientY) / 2;
        const container = containerRef.current;
        if (!container || next === 1) {
          setScale(next);
          if (next === 1) setOffset({ x: 0, y: 0 });
          return;
        }
        const rect = container.getBoundingClientRect();
        const pointX = midX - rect.left - rect.width / 2;
        const pointY = midY - rect.top - rect.height / 2;
        const ratio = next / start.scale;
        setScale(next);
        setOffset({
          x: pointX - (pointX - start.offset.x) * ratio,
          y: pointY - (pointY - start.offset.y) * ratio,
        });
      }
    };

    node.addEventListener("wheel", onWheel, { passive: false });
    node.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      node.removeEventListener("wheel", onWheel);
      node.removeEventListener("touchmove", onTouchMove);
    };
  }, [zoomBy]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        zoomBy(ZOOM_STEP);
      }
      if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        zoomBy(-ZOOM_STEP);
      }
      if (event.key === "0") {
        event.preventDefault();
        reset();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [reset, zoomBy]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch" || scale <= 1) return;
    event.preventDefault();
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      ox: offset.x,
      oy: offset.y,
    };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    setOffset({
      x: drag.ox + (event.clientX - drag.x),
      y: drag.oy + (event.clientY - drag.y),
    });
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
  };

  const onDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (scale > 1) {
      reset();
      return;
    }
    zoomAt(2.4, event.clientX, event.clientY);
  };

  const onTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 2) {
      pinchRef.current = {
        distance: pinchDistance(event.touches[0], event.touches[1]),
        scale,
        offset: { ...offset },
      };
      dragRef.current = null;
      setDragging(false);
      return;
    }

    if (event.touches.length === 1 && scale > 1) {
      const touch = event.touches[0];
      dragRef.current = {
        pointerId: -1,
        x: touch.clientX,
        y: touch.clientY,
        ox: offset.x,
        oy: offset.y,
      };
      setDragging(true);
    }
  };

  const onTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 2) return;

    const drag = dragRef.current;
    if (event.touches.length === 1 && drag) {
      const touch = event.touches[0];
      setOffset({
        x: drag.ox + (touch.clientX - drag.x),
        y: drag.oy + (touch.clientY - drag.y),
      });
    }
  };

  const onTouchEnd = () => {
    if (pinchRef.current) pinchRef.current = null;
    dragRef.current = null;
    setDragging(false);
  };

  const percent = Math.round(scale * 100);
  const canZoomOut = scale > MIN_SCALE + 0.01;
  const canZoomIn = scale < MAX_SCALE - 0.01;

  return (
    <div className="relative flex w-full min-w-0 flex-col items-center">
      <div
        ref={containerRef}
        className={cn(
          "relative flex h-[70dvh] w-full min-w-0 touch-none items-center justify-center overflow-hidden",
          scale > 1 ? (dragging ? "cursor-grabbing" : "cursor-grab") : "cursor-zoom-in",
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={onDoubleClick}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="max-h-full max-w-full select-none object-contain"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: "center center",
            transition: dragging ? "none" : "transform 120ms ease-out",
          }}
        />
      </div>

      <div className="pointer-events-none absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full border bg-background/90 p-1 shadow-md backdrop-blur">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="pointer-events-auto h-8 w-8"
          disabled={!canZoomOut}
          onClick={() => zoomBy(-ZOOM_STEP)}
          aria-label="Уменьшить"
        >
          <Minus className="h-4 w-4" />
        </Button>
        <span className="min-w-12 text-center text-xs tabular-nums text-muted-foreground">
          {percent}%
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="pointer-events-auto h-8 w-8"
          disabled={!canZoomIn}
          onClick={() => zoomBy(ZOOM_STEP)}
          aria-label="Увеличить"
        >
          <Plus className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="pointer-events-auto h-8 w-8"
          disabled={!canZoomOut}
          onClick={reset}
          aria-label="Сбросить масштаб"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
