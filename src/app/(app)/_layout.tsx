import { Stack } from 'expo-router';
import { AppHeader } from '@/components/AppHeader';
import { colors } from '@/lib/theme';

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        header: ({ options, route }) => {
          const enInicio = route.name === 'index';
          return <AppHeader title={enInicio ? undefined : options.title} showHome={!enInicio} />;
        },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Inicio' }} />
      <Stack.Screen name="picking" options={{ title: 'Picking · Órdenes activas' }} />
      <Stack.Screen name="picking/[tipo]/[id]" options={{ title: 'Picking · Pre-órdenes' }} />
      <Stack.Screen name="picking/preorden/[id]" options={{ title: 'Picking · Alistar' }} />
    </Stack>
  );
}
