import { MapContainer, TileLayer } from 'react-leaflet'

export default function MapView() {
  return (
    <div className="w-full h-full relative">
      <MapContainer
        center={[20, 0]}
        zoom={3}
        zoomControl={false}
        className="w-full h-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
        />
      </MapContainer>
    </div>
  )
}
