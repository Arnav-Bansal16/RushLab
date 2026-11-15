"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Suspense, useCallback, useRef, useState } from "react";
import type { Point } from "@/domain";
import { demoFestival } from "@/fixtures/demoFestival";
import { downloadLayoutImage } from "./exportImage";
import BehaviorAttributes from "./BehaviorAttributes";
import ComponentForm from "./ComponentForm";
import { createFestivalDemo } from "../playback/vendorDemo";
import TemplateToolbar from "../templates/TemplateToolbar";
import PlaybackWorkspace from "../playback/PlaybackWorkspace";
import {
  snapshotFestival,
  validateSimulationFestival,
} from "./simulationInput";
import {
  addComponent,
  createBlankLayout,
  editComponent,
  fromFestival,
  kindLabels,
  layoutItems,
  removeComponent,
  resizeSite,
  type LayoutDocument,
  type NewComponent,
} from "./layout";

const MapCanvas = dynamic(() => import("./MapCanvas"), {
  ssr: false,
  loading: () => <div className="map-canvas loading">Loading venue map…</div>,
});

export default function FestivalEditor() {
  const imageExporter = useRef<(() => string) | null>(null);
  const onImageExportReady = useCallback((exporter: (() => string) | null) => {
    imageExporter.current = exporter;
  }, []);
  const [exportingImage, setExportingImage] = useState(false);
  const [history, setHistory] = useState<{
    past: LayoutDocument[];
    present: LayoutDocument;
  }>(() => ({ past: [], present: createBlankLayout() }));
  const layout = history.present;
  const items = layoutItems(layout);
  const simulationIssues = validateSimulationFestival(snapshotFestival(layout));
  const [selectedId, setSelectedId] = useState("");
  const selected = items.find((item) => item.id === selectedId);
  const vendor = layout.vendors.find((item) => item.id === selectedId);
  const [notice, setNotice] = useState(
    "Start with a blank canvas. Add the components your event needs.",
  );
  function commit(next: LayoutDocument, message?: string) {
    setHistory((current) => ({
      past: [...current.past.slice(-49), current.present],
      present: next,
    }));
    if (message) setNotice(message);
  }
  const loadSavedTemplate = useCallback(
    (document: LayoutDocument, name: string) => {
      setHistory((current) => ({
        past: [...current.past.slice(-49), current.present],
        present: structuredClone(document),
      }));
      setSelectedId("");
      setNotice(name === "Unsaved draft" ? "" : `Opened ${name}.`);
    },
    [],
  );
  function move(id: string, position: Point) {
    commit(
      editComponent(layout, id, { position }),
      "Position updated. Export your layout to save it.",
    );
  }
  function add(details: NewComponent) {
    const result = addComponent(layout, details);
    commit(
      result.document,
      `${details.name} added. Drag it into position or use the coordinate fields.`,
    );
    setSelectedId(result.id);
  }
  async function exportLayout() {
    if (!imageExporter.current) {
      setNotice("The map is still loading. Try exporting again in a moment.");
      return;
    }
    setExportingImage(true);
    try {
      await downloadLayoutImage(
        imageExporter.current(),
        layout.name,
        layout.boundsMeters.width,
        layout.boundsMeters.height,
      );
      setNotice(
        "Event plan downloaded as a PNG image, including gates, exits, and custom areas.",
      );
    } catch {
      setNotice("The image could not be exported. Please try again.");
    } finally {
      setExportingImage(false);
    }
  }
  function exportSimulationJson() {
    if (simulationIssues.length) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(snapshotFestival(layout), null, 2)], {
        type: "application/json",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "rushlab-simulation-festival.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(
      "Simulation input exported. Exit markers and custom areas are excluded.",
    );
  }
  return (
    <main className="workspace">
      <header className="topbar">
        <Link href="/" className="brand" aria-label="RushLab home">
          R<span>RushLab</span>
        </Link>
        <span className="workspace-label">EVENT WORKSPACE</span>
        <span className="phase">01 / Venue builder</span>
      </header>
      <section className="page-heading">
        <div>
          <p className="eyebrow">MAKE SPACE FOR YOUR EVENT</p>
          <h1>Your event. Your blank canvas.</h1>
          <p>
            Build a layout around your event, with only the components you need.
          </p>
        </div>
        <button
          className="primary"
          onClick={() => exportLayout()}
          disabled={exportingImage}
          title="Download your event plan as a PNG image"
        >
          {exportingImage ? "Exporting…" : "Export layout (PNG)"}{" "}
          <span aria-hidden="true">↗</span>
        </button>
      </section>
      <Suspense fallback={<p>Loading template controls…</p>}>
        <TemplateToolbar layout={layout} onLoad={loadSavedTemplate} />
      </Suspense>
      <a className="playback-jump" href="#simulation-heading">
        Preview guest movement ↓
      </a>
      <section className="venue-toolbar" aria-label="Venue settings">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const name = String(data.get("event-name") ?? "").trim();
            if (!name) return;
            commit(
              resizeSite(
                {
                  ...layout,
                  name,
                  editor: {
                    ...layout.editor,
                    eventType: "Custom event",
                  },
                },
                {
                  width: Number(data.get("site-width")),
                  height: Number(data.get("site-height")),
                },
              ),
              "Venue settings updated. Components are kept within the site.",
            );
          }}
          key={`${layout.name}-${layout.boundsMeters.width}-${layout.boundsMeters.height}-${layout.editor.eventType}`}
        >
          <div>
            <label htmlFor="event-name">Event name</label>
            <input
              id="event-name"
              name="event-name"
              defaultValue={layout.name}
              required
              maxLength={100}
            />
          </div>
          <div>
            <label htmlFor="event-type">Event type</label>
            <select
              id="event-type"
              name="event-type"
              defaultValue="Custom event"
            >
              <option value="Custom event">Custom event</option>
            </select>
          </div>
          <div>
            <label htmlFor="site-width">Site width (m)</label>
            <input
              id="site-width"
              name="site-width"
              type="number"
              min="10"
              max="2000"
              step="1"
              required
              defaultValue={layout.boundsMeters.width}
            />
          </div>
          <div>
            <label htmlFor="site-height">Site height (m)</label>
            <input
              id="site-height"
              name="site-height"
              type="number"
              min="10"
              max="2000"
              step="1"
              required
              defaultValue={layout.boundsMeters.height}
            />
          </div>
          <button className="secondary" type="submit">
            Apply settings
          </button>
        </form>
        <div className="canvas-actions">
          <button
            className="secondary"
            disabled={!history.past.length}
            onClick={() => {
              setHistory((current) => ({
                past: current.past.slice(0, -1),
                present: current.past.at(-1) ?? current.present,
              }));
              setNotice("Last layout change undone.");
            }}
          >
            Undo
          </button>
          <button
            className="secondary"
            onClick={() => {
              commit(
                {
                  ...createBlankLayout(),
                  name: layout.name,
                  boundsMeters: layout.boundsMeters,
                  editor: {
                    ...createBlankLayout().editor,
                    eventType: layout.editor.eventType,
                  },
                },
                "Canvas cleared. Use Undo to restore it.",
              );
              setSelectedId("");
            }}
          >
            Clear canvas
          </button>
          <button
            className="secondary"
            onClick={() => {
              commit(
                fromFestival(demoFestival),
                "Example loaded. Every component, including the walkway, can be deleted.",
              );
              setSelectedId("");
            }}
          >
            Load example
          </button>
          <button
            className="secondary"
            onClick={() => {
              commit(
                createFestivalDemo(),
                "Behavior example loaded. Edit prices, attraction and dwell assumptions before running.",
              );
              setSelectedId("");
            }}
          >
            Load behavior example
          </button>
        </div>
      </section>
      <div className="venue-builder-layout">
        <aside className="inspector palette">
          <ComponentForm onAdd={add} />
        </aside>
        <section className="map-panel" aria-labelledby="map-title">
          <div className="panel-heading">
            <div>
              <h2 id="map-title">{layout.name}</h2>
              <p>
                {layout.editor.eventType} · {layout.boundsMeters.width} ×{" "}
                {layout.boundsMeters.height} meters · {items.length} components
              </p>
            </div>
            <span className="badge">
              <span />
              Editable layout
            </span>
          </div>
          <div className="venue-map-wrap">
            <MapCanvas
              festival={layout}
              onImageExportReady={onImageExportReady}
              annotations={layout.editor.elements}
              labels={layout.editor.labels}
              colors={layout.editor.colors}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onMove={move}
            />
            {!items.length && (
              <div className="empty-canvas">
                <strong>A space for your ideas</strong>
                <span>
                  Add a gate, stage, vendor, or custom area from the component
                  panel.
                </span>
              </div>
            )}
          </div>
          <div className="map-footer">
            <span>Grid: 10 m · All components can be moved or deleted</span>
            <span>Changes stay in this session until exported.</span>
          </div>
          <details className="simulation-handoff">
            <summary>Simulation input &amp; JSON export</summary>
            {simulationIssues.length ? (
              <ul>
                {simulationIssues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            ) : (
              <p>
                Layout fields pass the input checks. Use Run simulation below to
                generate recorded playback.
              </p>
            )}
            {layout.editor.elements.length > 0 && (
              <p>
                Exit markers and custom areas are saved with your layout. They
                are excluded from simulation input until their behavior is
                supported.
              </p>
            )}
            <button
              className="secondary"
              disabled={simulationIssues.length > 0}
              onClick={exportSimulationJson}
            >
              Export simulation JSON
            </button>
          </details>
        </section>
        <aside className="inspector properties">
          <p className="eyebrow">LAYOUT DETAILS</p>
          <h2>Component inspector</h2>
          <label htmlFor="entity-select">Selected item</label>
          <select
            id="entity-select"
            value={selected?.id ?? ""}
            onChange={(event) => setSelectedId(event.target.value)}
          >
            <option value="">Select a component</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {kindLabels[item.kind]}
              </option>
            ))}
          </select>
          {selected ? (
            <form
              className="builder-form"
              aria-label="Selected item attributes"
              onSubmit={(e) => e.preventDefault()}
            >
              <div className="vendor-category">{kindLabels[selected.kind]}</div>
              <label htmlFor="item-name">Component label</label>
              <input
                id="item-name"
                value={selected.name}
                maxLength={80}
                onChange={(event) =>
                  commit(
                    editComponent(layout, selected.id, {
                      name: event.target.value,
                    }),
                  )
                }
              />
              <details className="precise-position">
                <summary>Precise positioning (optional)</summary>
                <div className="field-pair">
                  {(["x", "y"] as const).map((axis) => (
                    <div key={axis}>
                      <label htmlFor={`position-${axis}`}>
                        {axis.toUpperCase()} position (m)
                      </label>
                      <input
                        id={`position-${axis}`}
                        type="number"
                        min="0"
                        max={
                          axis === "x"
                            ? layout.boundsMeters.width - selected.size.width
                            : layout.boundsMeters.height - selected.size.height
                        }
                        step="any"
                        value={Number(selected.position[axis].toFixed(2))}
                        onChange={(e) => {
                          if (
                            e.target.value !== "" &&
                            Number.isFinite(e.target.valueAsNumber)
                          )
                            move(selected.id, {
                              ...selected.position,
                              [axis]: e.target.valueAsNumber,
                            });
                        }}
                      />
                    </div>
                  ))}
                </div>
              </details>
              {selected.kind !== "gate" && (
                <div className="field-pair">
                  {(["width", "height"] as const).map((axis) => (
                    <div key={axis}>
                      <label htmlFor={`item-${axis}`}>
                        {axis === "width" ? "Width (m)" : "Height (m)"}
                      </label>
                      <input
                        id={`item-${axis}`}
                        type="number"
                        min="0.5"
                        max={layout.boundsMeters[axis]}
                        step="any"
                        value={Number(selected.size[axis].toFixed(2))}
                        onChange={(e) => {
                          if (e.target.valueAsNumber >= 0.5)
                            commit(
                              editComponent(layout, selected.id, {
                                size: {
                                  ...selected.size,
                                  [axis]: e.target.valueAsNumber,
                                },
                              }),
                            );
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
              <label htmlFor="item-color">Component color</label>
              <input
                id="item-color"
                type="color"
                value={selected.color}
                onChange={(e) =>
                  commit(
                    editComponent(layout, selected.id, {
                      color: e.target.value,
                    }),
                  )
                }
              />
              {layout.editor.elements.some(
                (item) => item.id === selected.id,
              ) && (
                <>
                  <label htmlFor="item-shape">Shape</label>
                  <select
                    id="item-shape"
                    value={selected.shape}
                    onChange={(e) =>
                      commit(
                        editComponent(layout, selected.id, {
                          shape: e.target.value as "rectangle" | "circle",
                        }),
                      )
                    }
                  >
                    <option value="rectangle">Rectangle</option>
                    <option value="circle">Ellipse / circle</option>
                  </select>
                </>
              )}
              <BehaviorAttributes
                key={JSON.stringify([
                  selected.id,
                  vendor?.averagePrice,
                  vendor?.serviceTimeSeconds,
                  [...layout.stages, ...(layout.amenities ?? [])].find(
                    (item) => item.id === selected.id,
                  ),
                ])}
                layout={layout}
                id={selected.id}
                onChange={commit}
              />
              {vendor && (
                <>
                  <label htmlFor="servers">Service counters</label>
                  <input
                    id="servers"
                    type="number"
                    min="1"
                    step="1"
                    value={vendor.servers}
                    aria-describedby="counters-help"
                    onChange={(e) => {
                      const count = e.target.valueAsNumber;
                      if (Number.isSafeInteger(count) && count >= 1)
                        commit({
                          ...layout,
                          vendors: layout.vendors.map((item) =>
                            item.id === vendor.id
                              ? { ...item, servers: count }
                              : item,
                          ),
                        });
                    }}
                  />
                  <p className="muted" id="counters-help">
                    Number of attendees this vendor can serve simultaneously.
                  </p>
                </>
              )}
              {layout.editor.elements.some(
                (item) => item.id === selected.id,
              ) && (
                <p className="muted">
                  A visual layout marker. Routing and behavior for this
                  component are not connected to the simulation yet.
                </p>
              )}
              <button
                className="danger"
                type="button"
                onClick={() => {
                  commit(
                    removeComponent(layout, selected.id),
                    `${selected.name} deleted. Use Undo to restore it.`,
                  );
                  setSelectedId("");
                }}
              >
                Delete component
              </button>
            </form>
          ) : (
            <p className="muted inspector-empty">
              Select any component on the map or in this list to rename, resize,
              recolor, move, or delete it.
            </p>
          )}
        </aside>
      </div>
      <PlaybackWorkspace layout={layout} />
      <footer className="status" role="status">
        {notice}
      </footer>
    </main>
  );
}
