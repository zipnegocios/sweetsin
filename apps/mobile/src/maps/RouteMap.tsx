import { useEffect, useMemo, useRef } from "react";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { useTheme } from "../design-system";
import { decodePolyline } from "./decode-polyline";
import type { RouteInfo } from "./types";

const EDGE_PADDING = { top: 32, right: 32, bottom: 32, left: 32 };

/** Ruta de referencia (sin navegación): polilínea + origen/destino, con la cámara ajustada a ambos. */
export function RouteMap({ route, height }: { route: RouteInfo; height: number }) {
  const theme = useTheme();
  const mapRef = useRef<MapView>(null);
  const path = useMemo(() => decodePolyline(route.encodedPolyline), [route.encodedPolyline]);
  const coordinates = useMemo(
    () =>
      [route.origin, ...path, route.destination].map((p) => ({ latitude: p.lat, longitude: p.lng })),
    [path, route.origin, route.destination],
  );

  const fit = () =>
    mapRef.current?.fitToCoordinates(coordinates, { edgePadding: EDGE_PADDING, animated: false });
  useEffect(() => {
    fit();
  }, [coordinates]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <MapView
      ref={mapRef}
      provider={PROVIDER_GOOGLE}
      style={{ height, borderRadius: theme.components.card.radius }}
      initialRegion={{
        latitude: route.origin.lat,
        longitude: route.origin.lng,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }}
      onMapReady={fit}
      toolbarEnabled={false}
    >
      <Polyline coordinates={coordinates} strokeColor={theme.colors.actionFill} strokeWidth={5} />
      <Marker coordinate={coordinates[0]!} pinColor={theme.colors.info} />
      <Marker coordinate={coordinates[coordinates.length - 1]!} pinColor={theme.colors.actionFill} />
    </MapView>
  );
}
