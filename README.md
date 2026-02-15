# Map Region

An interactive web tool for visualizing and styling geographic regions on a map. Hover countries to load their subdivisions, overlay them on the map, customize their appearance, and add draggable labels.

## Usage

1. **Hover** a country to highlight it and preload its subdivision data
2. **Click** a country to add it as an overlay
3. **Hold Shift + hover** to see and select individual subdivisions (states, provinces, etc.)
4. **Search** by name — countries are always searchable, but subdivisions and districts only appear after hovering their parent country
5. **Style** any selected layer with custom colors, opacity, and stroke settings
6. **Drag labels** to reposition them, click to edit text
7. **Export / Import** your map data as JSON to save or share your work
8. **Hide UI** to get a clean view for screenshots, press any key to restore

## Features

- **Region Search** — Fuzzy matching and autocomplete for countries, states/provinces, and districts/counties
- **Hover to Load** — Hover a country to preload its subdivisions and districts in the background
- **Shift + Hover** — Hold Shift to highlight and select individual subdivisions
- **Hover Labels** — Region name follows your cursor on hover
- **Overlay Styling** — Customize fill color, stroke color, opacity, width, and dash style per overlay
- **Custom Labels** — Add draggable, click-to-edit text labels anchored to geographic coordinates
- **Export / Import** — Save and load your map data as JSON files
- **Persistent State** — Overlays and labels are saved to localStorage and restored on reload
- **Reset** — Clear all overlays, labels, and saved data with one click

## Data Sources

| Level | Source | Description |
|-------|--------|-------------|
| Admin0 (countries) | [world-atlas](https://github.com/topojson/world-atlas) via jsDelivr | TopoJSON, all countries in a single file (~300KB) |
| Admin1 (states/provinces) | [admin-boundaries](https://github.com/stephanietuerk/admin-boundaries) | GADM v3.6 GeoJSON, simplified, per-country files loaded on demand |
| Admin2 (districts/counties) | [admin-boundaries](https://github.com/stephanietuerk/admin-boundaries) | GADM v3.6 GeoJSON, simplified, per-country files loaded on demand |

Only country boundaries (~300KB) are loaded on page load. Admin1 and Admin2 data are lazy-loaded per country when the user hovers, searches, or selects a country, then cached in memory.

## Development

```bash
yarn install
yarn dev
```

### Tech Stack

- React + Vite
- Leaflet / react-leaflet
- Tailwind CSS
