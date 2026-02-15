# Map Region

An interactive web tool for visualizing and styling geographic regions on a map. Hover countries to load their subdivisions, overlay them on the map, customize their appearance, and add draggable labels.

## Features

- **Region Search** - Search and add countries, states/provinces, or districts/counties as map overlays
- **Hover to Load** - Hover a country on the map to preload its subdivisions and districts in the background
- **Shift + Hover** - Hold Shift and hover to highlight individual subdivisions (states, provinces, etc.)
- **Overlay Styling** - Customize fill color, stroke color, opacity, width, and dash style per overlay
- **Custom Labels** - Add draggable text labels anchored to geographic coordinates, with configurable font size and color
- **Hide UI** - Hide all controls for a clean screenshot, press any key to restore
- **Persistent State** - Overlays and labels are saved to localStorage and restored on reload
- **Reset** - Clear all overlays, labels, and saved data with one click

## Getting Started

```bash
npm install
npm run dev
```

## Usage

1. **Hover** a country to highlight it and preload its subdivision data
2. **Click** a country to add it as an overlay
3. **Hold Shift + hover** to see and select individual subdivisions (states, provinces, etc.)
4. **Search** by name — countries are always searchable, but subdivisions and districts only appear after hovering their parent country
5. **Style** any selected layer with custom colors, opacity, and stroke settings
6. **Drag labels** to reposition them on the map

## Tech Stack

- React + Vite
- Leaflet / react-leaflet
- Tailwind CSS
- Fuse.js (fuzzy search)

## Data Sources

| Level | Source | Description |
|-------|--------|-------------|
| Admin0 (countries) | [world-atlas](https://github.com/topojson/world-atlas) via jsDelivr | TopoJSON, all countries in a single file (~300KB) |
| Admin1 (states/provinces) | [admin-boundaries](https://github.com/stephanietuerk/admin-boundaries) | GADM v3.6 GeoJSON, simplified, per-country files loaded on demand |
| Admin2 (districts/counties) | [admin-boundaries](https://github.com/stephanietuerk/admin-boundaries) | GADM v3.6 GeoJSON, simplified, per-country files loaded on demand |

### Data Loading

Only country boundaries (~300KB) are loaded on page load. Admin1 and Admin2 data are **lazy-loaded per country** when the user hovers, searches, or selects a country, then cached in memory. This keeps the initial load fast while supporting all ~230 countries with full subdivision data.
