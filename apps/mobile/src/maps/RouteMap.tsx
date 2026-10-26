import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { useTheme } from "../design-system";
import { decodePolyline } from "./decode-polyline";
import { hasTraffic, trafficRuns } from "./traffic-runs";
import type { LatLng, RouteInfo } from "./types";

const EDGE_PADDING = { top: 32, right: 32, bottom: 32, left: 32 };
const toCoord = (p: LatLng) => ({ latitude: p.lat, longitude: p.lng });

/**
 * Ruta de referencia (la navegación giro a giro queda en Google Maps): tramos coloreados por tráfico,
 * posición en vivo del repartidor y capa de tráfico de Google. `overlay` se dibuja encima del mapa y recibe si hay
 * tramos lentos o detenidos, para decirlo en texto con los mismos tramos que se colorean.
 */
export function RouteMap({
  route,
  height,
  overlay,
}: {
  route: RouteInfo;
  height: number;
  overlay?: (info: { hasTraffic: boolean }) => ReactNode;
}) {
  const t = useTheme().components.map;
  const mapRef = useRef<MapView>(null);
  const path = useMemo(() => decodePolyline(route.encodedPolyline), [route.encodedPolyline]);
  const runs = useMemo(() => trafficRuns(path, route.trafficSegments), [path, route.trafficSegments]);
  const fitCoords = useMemo(
    () => [route.origin, ...path, route.destination].map(toCoord),
    [path, route.origin, route.destination],
  );
  const fitRef = useRef(fitCoords);
  fitRef.current = fitCoords;

  // Encuadra al abrir y si cambia el destino; el refresco periódico no le mueve la cámara al repartidor.
  const fit = () => mapRef.current?.fitToCoordinates(fitRef.current, { edgePadding: EDGE_PADDING, animated: false });
  useEffect(() => {
    fit();
  }, [route.destination.lat, route.destination.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={{ height, borderRadius: t.radius, overflow: "hidden" }}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        initialRegion={{ ...toCoord(route.origin), latitudeDelta: 0.05, longitudeDelta: 0.05 }}
        onMapReady={fit}
        showsUserLocation
        showsMyLocationButton={false}
        showsTraffic
        toolbarEnabled={false}
        // En Android, con el arrastre habilitado el mapa bloquea el scroll de la lista en ACTION_DOWN
        // (requestDisallowInterceptTouchEvent(isScrollGesturesEnabled())). La cámara se encuadra sola y la
        // navegación real va en Google Maps; el zoom con dos dedos queda habilitado.
        scrollEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
      >
        {runs.map((run, i) => (
          <Polyline
            key={`${i}-${run.speed}`}
            coordinates={run.points.map(toCoord)}
            strokeColor={t.traffic[run.speed]}
            strokeWidth={t.strokeWidth}
          />
        ))}
        <Marker coordinate={toCoord(route.origin)} pinColor={t.markerOrigin} />
        <Marker coordinate={toCoord(route.destination)} pinColor={t.markerDestination} />
      </MapView>
      {overlay ? (
        <View pointerEvents="box-none" style={{ position: "absolute", top: t.overlay.inset, left: t.overlay.inset, right: t.overlay.inset }}>
          {overlay({ hasTraffic: hasTraffic(runs) })}
        </View>
      ) : null}
    </View>
  );
}
