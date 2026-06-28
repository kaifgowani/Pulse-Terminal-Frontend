import React from 'react';
import { View } from 'react-native';
import { Canvas, Path, LinearGradient, vec, Skia } from '@shopify/react-native-skia';

interface SparklineProps {
  data: number[];
  width: number;
  height: number;
  color: string;
}

export default function Sparkline({ data, width, height, color }: SparklineProps) {
  if (!data || data.length === 0) return <View style={{ width, height }} />;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const stepX = width / (data.length - 1 || 1);

  const path = Skia.Path.Make();
  const gradientPath = Skia.Path.Make();

  data.forEach((val, i) => {
    const x = i * stepX;
    const y = height - ((val - min) / range) * height;
    if (i === 0) {
      path.moveTo(x, y);
      gradientPath.moveTo(x, y);
    } else {
      path.lineTo(x, y);
      gradientPath.lineTo(x, y);
    }
  });

  gradientPath.lineTo(width, height);
  gradientPath.lineTo(0, height);
  gradientPath.close();

  return (
    <View style={{ width, height, overflow: 'hidden' }}>
      <Canvas style={{ width, height }}>
        <Path path={gradientPath}>
          <LinearGradient
            start={vec(0, 0)}
            end={vec(0, height)}
            colors={[`${color}80`, `${color}00`]}
          />
        </Path>
        <Path path={path} style="stroke" strokeWidth={2} color={color} />
      </Canvas>
    </View>
  );
}
