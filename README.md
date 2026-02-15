# Map Region

An interactive web tool for visualizing and styling geographic regions on a map. Search for countries or subdivisions, overlay them on the map, customize their appearance, and add draggable labels.

## Features

- **Region Search** - Search and add countries or administrative subdivisions (states, provinces) as map overlays
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
