'use client'
import { useEffect, useState } from 'react'
import { GOOGLE_MAPS_LIBRARIES } from '@lib/util/google-maps-loader'
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api'

type ContactMapProps = {
  apiKey: string
  address: string
}

const mapOptions: google.maps.MapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  scrollwheel: false,
  gestureHandling: 'cooperative',
}

const containerStyle = { width: '100%', height: '100%' }

/** Renders nothing without an API key — avoids injecting the Maps script with an invalid key. */
export default function ContactMap(props: ContactMapProps) {
  if (!props.apiKey?.trim()) return null
  return <ContactMapImpl {...props} />
}

function ContactMapImpl({ apiKey, address }: ContactMapProps) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: apiKey,
    libraries: GOOGLE_MAPS_LIBRARIES,
  })
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    if (!isLoaded || !address) return
    new google.maps.Geocoder().geocode({ address }, (results, status) => {
      if (status === 'OK' && results?.[0]?.geometry?.location) {
        const loc = results[0].geometry.location
        setCoords({ lat: loc.lat(), lng: loc.lng() })
      }
    })
  }, [isLoaded, address])

  if (!isLoaded || !coords) {
    return (
      <div className='h-full w-full animate-pulse rounded-xl bg-gray-100' />
    )
  }

  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      mapContainerClassName='rounded-xl overflow-hidden'
      center={coords}
      zoom={16}
      options={mapOptions}
    >
      <Marker position={coords} />
    </GoogleMap>
  )
}
