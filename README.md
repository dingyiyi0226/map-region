# Map Region

An interactive web tool for visualizing and styling geographic regions on a map. Hover countries to load their subdivisions, overlay them on the map, customize their appearance, and add draggable labels.

## Usage

| Action | Result |
|---|---|
| Hover a country | Highlights the boundary and preloads subdivision data |
| Click a country | Adds it as a styled overlay |
| Hold Shift + hover | Switches to admin1 subdivision view |
| Click a subdivision | Adds it as an overlay |
| Search box | Find countries, regions, or districts by name |
| `→` in search | Expand a result to list its children |
| `Tab` | Accept the autocomplete suggestion |
| Shift-click in Layers panel | Multi-select layers for batch styling |
| Drag a label | Reposition it on the map |
| Any key (while UI is hidden) | Restore the interface |

## Features

- **Region Search** — Fuzzy matching and autocomplete for countries, states/provinces, and districts/counties
- **Hover to Load** — Hover a country to preload its subdivisions and districts in the background
- **Shift + Hover** — Hold Shift to highlight and select individual subdivisions (states, provinces)
- **Multi-select** — Shift-click layers in the Layers panel to select multiple; batch-edit their style together
- **Hover Labels** — Region name follows the cursor on hover
- **Overlay Styling** — Customize fill color, stroke color, opacity, width, and dash style per overlay or in batch
- **Labels** — Auto-placed draggable text labels anchored to each region's centroid; edit text, color, and font size
- **Custom Labels** — Add free-standing draggable text labels placed at the current map center
- **Native Names** — Toggle between English and local-language region names
- **Base Map** — Switch between Light, Dark, Voyager, OpenStreetMap, and Terrain tiles
- **Export / Import** — Save and load your map data as JSON files
- **Persistent State** — Overlays and labels are saved to `localStorage` and restored on reload
- **Hide UI** — Clear the interface for clean screenshots; press any key to restore
- **Reset** — Clear all overlays, labels, and saved data with one click

## Data Sources

| Level | Source | Description |
|---|---|---|
| Admin0 (countries) | [world-atlas](https://github.com/topojson/world-atlas) via jsDelivr | TopoJSON, all countries in a single file (~300 KB) |
| Admin1 (states/provinces) | [admin-boundaries](https://github.com/stephanietuerk/admin-boundaries) | GADM v3.6 GeoJSON, simplified, per-country files loaded on demand |
| Admin2 (districts/counties) | [admin-boundaries](https://github.com/stephanietuerk/admin-boundaries) | GADM v3.6 GeoJSON, simplified, per-country files loaded on demand |

Only country boundaries (~300 KB) are fetched on page load. Admin1 and Admin2 data are lazy-loaded per country when the user hovers, searches, or selects a country, then cached in memory for the session.

## Development

```bash
yarn install
yarn dev
```

## Tech Stack

| Library | Role |
|---|---|
| [React 19](https://react.dev) | UI framework |
| [Leaflet](https://leafletjs.com) + [react-leaflet](https://react-leaflet.js.org) | Interactive map |
| [Tailwind CSS v4](https://tailwindcss.com) | Styling |
| [lucide-react](https://lucide.dev) | Icons |
| [topojson-client](https://github.com/topojson/topojson-client) | Country boundary parsing |
| [Vite](https://vitejs.dev) | Build tool |

## Project Structure

```
src/
├── components/
│   ├── MapView.jsx          # Root map component; owns all state and handlers
│   ├── HoverLayer.jsx       # Transparent Leaflet layer that captures hover/click
│   ├── RegionLayer.jsx      # Renders styled overlay polygons
│   ├── LabelLayer.jsx       # Draggable Leaflet marker labels
│   ├── SearchPanel.jsx      # Search box with fuzzy matching and keyboard navigation
│   ├── LayersPanel.jsx      # Sidebar list of added overlays and custom labels
│   ├── StylePanel.jsx       # Style editor for selected overlay(s) and their labels
│   └── CustomLabelPanel.jsx # Style editor for selected free-standing labels
├── hooks/
│   ├── useGeoData.js        # Manages country/admin1/admin2 data and lazy loading
│   └── usePersistence.js    # Auto-save, export, and import logic
└── data/
    ├── geo.js               # Fetch, cache, and antimeridian-fix GeoJSON/TopoJSON
    └── countryMappings.js   # Country name → ISO 3166-1 alpha-3 lookup table
```
