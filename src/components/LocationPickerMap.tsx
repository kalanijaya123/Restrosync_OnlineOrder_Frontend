import { useEffect, useRef } from 'react'
import L from 'leaflet'

type Coords = { lat: number; lng: number }

type Props = {
    center: Coords
    customerLocation: Coords | null
    restaurantLocation?: Coords | null
    onSelect: (coords: Coords) => void
    height?: number
}

const LocationPickerMap = ({
    center,
    customerLocation,
    restaurantLocation,
    onSelect,
    height = 280
}: Props) => {
    const mapContainerRef = useRef<HTMLDivElement | null>(null)
    const mapRef = useRef<L.Map | null>(null)
    const layerRef = useRef<L.LayerGroup | null>(null)

    useEffect(() => {
        if (!mapContainerRef.current || mapRef.current) return

        const map = L.map(mapContainerRef.current).setView([center.lat, center.lng], 13)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map)

        const layer = L.layerGroup().addTo(map)

        map.on('click', (event: L.LeafletMouseEvent) => {
            onSelect({ lat: event.latlng.lat, lng: event.latlng.lng })
        })

        mapRef.current = map
        layerRef.current = layer

        return () => {
            map.remove()
            mapRef.current = null
            layerRef.current = null
        }
    }, [center.lat, center.lng, onSelect])

    useEffect(() => {
        if (!mapRef.current) return
        mapRef.current.setView([center.lat, center.lng], mapRef.current.getZoom())
    }, [center.lat, center.lng])

    useEffect(() => {
        const map = mapRef.current
        const layer = layerRef.current
        if (!map || !layer) return

        layer.clearLayers()

        if (restaurantLocation) {
            L.circleMarker([restaurantLocation.lat, restaurantLocation.lng], {
                radius: 7,
                color: '#7c2d12',
                fillColor: '#fb923c',
                fillOpacity: 0.9,
                weight: 2
            }).bindPopup('Restaurant').addTo(layer)
        }

        if (customerLocation) {
            L.circleMarker([customerLocation.lat, customerLocation.lng], {
                radius: 8,
                color: '#1d4ed8',
                fillColor: '#3b82f6',
                fillOpacity: 0.9,
                weight: 2
            }).bindPopup('Your location').addTo(layer)
        }
    }, [customerLocation, restaurantLocation])

    return (
        <div
            ref={mapContainerRef}
            style={{ height: `${height}px`, width: '100%', borderRadius: 14, overflow: 'hidden' }}
        />
    )
}

export default LocationPickerMap
