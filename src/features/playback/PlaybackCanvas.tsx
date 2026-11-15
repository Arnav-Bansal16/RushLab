"use client";
import { memo, useEffect, useRef, useState } from "react";
import { Stage, Layer, Rect, Line, Text, Group, Shape } from "react-konva";
import type Konva from "konva";
import type { Festival, SimulationFrame } from "../../domain";
import { fitViewport, metersToPixels, type Viewport } from "../editor/geometry";
import { attendeeStyle } from "./presentation";

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
          fill={attendeeStyle(person).color}
          opacity={attendeeStyle(person).opacity}
          listening={false}
          perfectDrawEnabled={false}
        />
      ))}
    </>
  );
}
export function AmenityMarks({
  festival,
  transform,
}: {
  festival: Festival;
  transform: Viewport;
}) {
  return (
    <>
      {(festival.amenities ?? []).map((item) => (
        <Group
          key={item.id}
          name="amenity"
          {...metersToPixels(item.position, transform)}
        >
          <Rect
            width={item.size.width * transform.scale}
            height={item.size.height * transform.scale}
            fill={
              { restroom: "#79a5be", seating: "#a5b5da", first_aid: "#e39799" }[
                item.type
              ]
            }
            stroke="#334a50"
          />
          <Text
            text={`${item.name} · ${item.type.replaceAll("_", " ")}`}
            x={-30}
            y={-16}
            width={item.size.width * transform.scale + 60}
            align="center"
            fontSize={11}
            fill="#233f45"
          />
        </Group>
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
          <AmenityMarks festival={festival} transform={transform} />
          {festival.entrances.map((item) => (
            <Group key={item.id} {...point(item.position)}>
              <Rect x={-13} y={-8} width={26} height={16} fill="#a42640" />
              <Text
                text="EXIT"
                x={-13}
                y={-5}
                width={26}
                align="center"
                fill="white"
                fontSize={10}
              />
              <Text
                text={item.name}
                x={-20}
                y={12}
                fontSize={11}
                fill="#275146"
              />
            </Group>
          ))}
          {festival.vendors.map((item) => {
            const state = frame.vendors.find(
              (vendor) => vendor.vendorId === item.id,
            );
            return (
              <Group key={item.id} {...point(item.position)}>
                <Rect
                  width={item.size.width * s}
                  height={item.size.height * s}
                  fill={state?.inventoryRemaining === 0 ? "#a5afa2" : "#dfaa70"}
                />
                <Text
                  text={`${item.name}\nAvg. price: ${item.averagePrice} currency units`}
                  x={-35}
                  y={-30}
                  width={item.size.width * s + 70}
                  align="center"
                  fontSize={11}
                  fill="#573415"
                />
                {state && (
                  <Text
                    text={
                      state.inventoryRemaining === 0
                        ? "Out of stock"
                        : `${state.queueLength} waiting${state.queueFull ? " · FULL" : ""}`
                    }
                    x={-25}
                    y={item.size.height * s + 5}
                    width={item.size.width * s + 50}
                    align="center"
                    fontSize={10}
                    fill={
                      state.inventoryRemaining === 0 ? "#9d3f31" : "#795c17"
                    }
                  />
                )}
              </Group>
            );
          })}
        </Layer>
        <Layer listening={false}>
          <AttendeeMarks frame={frame} transform={transform} />
        </Layer>
      </Stage>
    </div>
  );
}
export default memo(PlaybackCanvas);
