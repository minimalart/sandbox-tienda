'use client'
import { useEffect, useState } from 'react'
import { GOOGLE_MAPS_LIBRARIES } from '@lib/util/google-maps-loader'
import { buildGoogleMapsEmbedUrl } from '@lib/util/contact-map'
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

function EmbeddedContactMap({ address }: Pick<ContactMapProps, 'address'>) {
  return (
    <iframe
      className='h-full w-full border-0'
      src={buildGoogleMapsEmbedUrl(address)}
      title={`Mapa de ${address}`}
      loading='lazy'
      referrerPolicy='no-referrer-when-downgrade'
    />
  )
}

/**
 * The interactive map is preferred when its key is usable. The public embed is
 * an intentional fallback: a missing/restricted Geocoding API must not leave a
 * permanent grey skeleton where the address map should be.
 */
export default function ContactMap(props: ContactMapProps) {
  if (!props.apiKey?.trim()) return <EmbeddedContactMap address={props.address} />
  return <ContactMapImpl {...props} />
}

function ContactMapImpl({ apiKey, address }: ContactMapProps) {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey,
    libraries: GOOGLE_MAPS_LIBRARIES,
  })
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [geocodeFailed, setGeocodeFailed] = useState(false)

  useEffect(() => {
    if (!isLoaded || !address) return
    let active = true
    setCoords(null)
    setGeocodeFailed(false)
    new google.maps.Geocoder().geocode({ address }, (results, status) => {
      if (!active) return
      if (status === 'OK' && results?.[0]?.geometry?.location) {
        const loc = results[0].geometry.location
        setCoords({ lat: loc.lat(), lng: loc.lng() })
      } else {
        setGeocodeFailed(true)
      }
    })
    return () => {
      active = false
    }
  }, [isLoaded, address])

  if (loadError || geocodeFailed) return <EmbeddedContactMap address={address} />

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
