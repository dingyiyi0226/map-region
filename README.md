# Map Region

An interactive web tool for visualizing and styling geographic regions on a map. Search for countries or subdivisions, overlay them on the map, customize their appearance, and add draggable labels.

## Features

- **Region Search** - Search and add countries, states/provinces, or districts/counties as map overlays
- **Overlay Styling** - Customize fill color, stroke color, opacity, width, and dash style per overlay
- **Custom Labels** - Add draggable text labels anchored to geographic coordinates, with configurable font size and color
- **Export to PNG** - Export the current map view as a high-resolution PNG image
- **Persistent State** - Overlays and labels are saved to localStorage and restored on reload
- **Reset** - Clear all overlays, labels, and saved data with one click

## Getting Started

```bash
npm install
npm run dev
```

## Tech Stack

- React + Vite
- Leaflet / react-leaflet
- Tailwind CSS
- Fuse.js (fuzzy search)
- html-to-image (PNG export)

## Data Sources

| Level | Source | Description |
|-------|--------|-------------|
| Admin0 (countries) | [world-atlas](https://github.com/topojson/world-atlas) via jsDelivr | TopoJSON, all countries in a single file (~300KB) |
| Admin1 (states/provinces) | [Natural Earth](https://github.com/nvkelso/natural-earth-vector) | GeoJSON at 1:50m scale, all subdivisions in a single file (~2.3MB) |
| Admin2 (districts/counties) | [admin-boundaries](https://github.com/stephanietuerk/admin-boundaries) | GADM v3.6 GeoJSON, simplified, per-country files loaded on demand |

Admin0 and Admin1 data are loaded upfront on startup for search. Admin2 data is lazy-loaded per country when a country is selected or matched in search results, then cached in memory.
