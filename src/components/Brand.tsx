import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import MaskedViewBase, { type MaskedViewProps } from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts } from '@/lib/theme';

// Sus tipos de clase no encajan con @types/react 19; en ejecución funciona igual.
const MaskedView = MaskedViewBase as unknown as React.ComponentType<MaskedViewProps>;

const DURACION = 2800;
const logo = require('../../assets/images/logo-santacruz.png');

/** Avance 0→1 en bucle, compartido por el destello del logo y del texto (como .brillo-diamante / .texto-diamante). */
function useDestello() {
  const progreso = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let anim: Animated.CompositeAnimation | null = null;
    let cancelado = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reducir) => {
      if (reducir || cancelado) return;
      anim = Animated.loop(
        Animated.timing(progreso, { toValue: 1, duration: DURACION, easing: Easing.linear, useNativeDriver: true }),
      );
      anim.start();
    });
    return () => {
      cancelado = true;
      anim?.stop();
    };
  }, [progreso]);
  return progreso;
}

interface Props {
  /** lg: pantalla de acceso; sm: barra superior. */
  size?: 'lg' | 'sm';
  subtitle?: string;
}

export function Brand({ size = 'lg', subtitle }: Props) {
  const progreso = useDestello();
  const lg = size === 'lg';
  const logoSize = lg ? 64 : 48;

  return (
    <View style={[styles.row, { gap: lg ? 12 : 10 }]}>
      <LogoBrillante size={logoSize} progreso={progreso} />
      <View>
        <TextoDiamante
          text="SIGPRO"
          progreso={progreso}
          style={[styles.title, lg ? { fontSize: 42, lineHeight: 42 } : { fontSize: 28, lineHeight: 30 }]}
        />
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
    </View>
  );
}

function LogoBrillante({ size, progreso }: { size: number; progreso: Animated.Value }) {
  const ancho = size * 0.4;
  const translateX = progreso.interpolate({ inputRange: [0, 1], outputRange: [-1.5 * ancho, 3.5 * ancho] });
  return (
    <View style={[styles.logoWrap, { width: size, height: size, borderRadius: size / 2 }]}>
      <Image source={logo} style={{ width: size, height: size }} resizeMode="contain" />
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { width: ancho, transform: [{ translateX }, { skewX: '-20deg' }] }]}
      >
        <LinearGradient
          colors={['transparent', 'rgba(255,255,255,0.75)', 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

function TextoDiamante({
  text,
  style,
  progreso,
}: {
  text: string;
  style: React.ComponentProps<typeof Text>['style'];
  progreso: Animated.Value;
}) {
  const [medida, setMedida] = useState<{ w: number; h: number } | null>(null);
  const w = medida?.w ?? 0;
  // El degradado mide 3 veces el texto y su punto blanco (en 1.5w) recorre el texto de izquierda a derecha.
  const translateX = progreso.interpolate({ inputRange: [0, 1], outputRange: [-1.8 * w, -0.2 * w] });

  return (
    <View>
      <Text
        style={[style, { color: colors.brand, opacity: medida ? 0 : 1 }]}
        onLayout={(e) => setMedida({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      >
        {text}
      </Text>
      {medida && (
        <MaskedView
          style={[StyleSheet.absoluteFill, { width: medida.w, height: medida.h }]}
          maskElement={<Text style={[style, { color: '#000' }]}>{text}</Text>}
        >
          <Animated.View style={{ width: w * 3, height: medida.h, transform: [{ translateX }] }}>
            <LinearGradient
              colors={[colors.brand, colors.brand, '#9CA3AF', '#FFFFFF', '#9CA3AF', colors.brand, colors.brand]}
              locations={[0, 0.47, 0.49, 0.5, 0.51, 0.53, 1]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </MaskedView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  logoWrap: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.extraBold, letterSpacing: -1, color: colors.brand },
  subtitle: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    color: colors.brand,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginTop: 4,
  },
});
