"use client";
import { memo, useEffect, useRef, useState } from "react";
import {
  Stage,
  Layer,
  Rect,
  Line,
  Text,
  Circle,
  Group,
  Shape,
} from "react-konva";
import type Konva from "konva";
import type { Festival, SimulationFrame } from "../../domain";
import { fitViewport, metersToPixels, type Viewport } from "../editor/geometry";
import { statusStyles } from "./presentation";

/** A head, torso, arms and legs, drawn as one lightweight canvas shape per guest. */
export function drawPerson(context: Konva.Context, shape: Konva.Shape) {
  context.beginPath();
  context.arc(0, -4, 1.8, 0, Math.PI * 2);
  context.closePath();
  context.moveTo(-1.6, -1.5);
  for (const [x, y] of [
    [1.6, -1.5],
    [3, 2],
    [1.8, 2.5],
    [1.2, 0.5],
    [1.2, 3],
    [2, 6],
    [0.3, 6],
    [0, 3],
    [-0.3, 6],
    [-2, 6],
    [-1.2, 3],
    [-1.2, 0.5],
    [-1.8, 2.5],
    [-3, 2],
  ])
    context.lineTo(x, y);
  context.closePath();
  context.fillStrokeShape(shape);
}

export function AttendeeMarks({
  frame,
  transform,
}: {
  frame: SimulationFrame;
  transform: Viewport;
}) {
  return (
    <>
      {frame.attendees.map((person) => (
        <Shape
          key={person.id}
          name="attendee-person"
          {...metersToPixels(person.position, transform)}
          sceneFunc={drawPerson}
          scaleX={Math.max(0.65, Math.min(1.15, transform.scale * 0.18))}
          scaleY={Math.max(0.65, Math.min(1.15, transform.scale * 0.18))}
          fill={statusStyles[person.status].color}
          opacity={statusStyles[person.status].opacity}
          listening={false}
          perfectDrawEnabled={false}
        />
      ))}
    </>
  );
}
function PlaybackCanvas({
  festival,
  frame,
}: {
  festival: Festival;
  frame: SimulationFrame;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ width: 800, height: 500 });
  useEffect(() => {
    if (!host.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setViewport({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }),
    );
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  const transform = fitViewport(festival.boundsMeters, viewport),
    s = transform.scale;
  const point = (p: { x: number; y: number }) => metersToPixels(p, transform);
  const points = (list: { x: number; y: number }[]) =>
    list.flatMap((p) => {
      const value = point(p);
      return [value.x, value.y];
    });
  return (
    <div
      ref={host}
      data-attendee-count={frame.attendees.length}
      className="playback-map"
      role="img"
      aria-label={`Recorded attendee positions at ${frame.timeSeconds} simulation seconds. Exited attendees are faded. Attendee details and vendor states follow the map.`}
    >
      <Stage width={viewport.width} height={viewport.height}>
        <Layer listening={false}>
          <Rect
            width={viewport.width}
            height={viewport.height}
            fill="#f2f4ee"
          />
          <Rect
            {...transform.offset}
            width={festival.boundsMeters.width * s}
            height={festival.boundsMeters.height * s}
            fill="#eaf0e5"
            stroke="#bdcdb5"
          />
          {festival.paths.map((path) => (
            <Line
              key={path.id}
              points={points(path.points)}
              stroke="#fffaf0"
              strokeWidth={path.widthMeters * s}
              lineCap="round"
            />
          ))}
          {festival.obstacles.map((item) => (
            <Line
              key={item.id}
              points={points(item.points)}
              closed
              fill="#91a38b"
            />
          ))}
          {festival.stages.map((item) => (
            <Group key={item.id} {...point(item.position)}>
              <Rect
                width={item.size.width * s}
                height={item.size.height * s}
                fill="#293f3b"
              />
              <Text
                text={item.name}
                y={8}
                width={item.size.width * s}
                align="center"
                fill="white"
                fontSize={11}
              />
            </Group>
          ))}
          {festival.entrances.map((item) => (
            <Group key={item.id} {...point(item.position)}>
              <Circle radius={6} fill="#247963" />
              <Text
                text={item.name}
                x={-20}
                y={12}
                fontSize={11}
                fill="#275146"
              />
            </Group>
          ))}
          {festival.vendors.map((item) => (
            <Group key={item.id} {...point(item.position)}>
              <Rect
                width={item.size.width * s}
                height={item.size.height * s}
                fill="#dfaa70"
              />
              <Text
                text={item.name}
                x={-35}
                y={-18}
                width={item.size.width * s + 70}
                align="center"
                fontSize={11}
                fill="#573415"
              />
            </Group>
          ))}
        </Layer>
        <Layer listening={false}>
          <AttendeeMarks frame={frame} transform={transform} />
        </Layer>
      </Stage>
    </div>
  );
}
export default memo(PlaybackCanvas);
