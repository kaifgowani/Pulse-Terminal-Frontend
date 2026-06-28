import React, { useMemo } from 'react';
import { View, StyleSheet, Dimensions, Text } from 'react-native';
import { Canvas, Path, LinearGradient as SkiaLinearGradient, vec, Skia } from '@shopify/react-native-skia';
import { theme } from '../theme';

const { width } = Dimensions.get('window');

interface CommandChartProps {
  history: any[];
  technicalData: {
    sma_14: any[];
    rsi_14: any[];
  } | null;
  color: string;
  scrubIndex: number | null;
}

export const CommandChart: React.FC<CommandChartProps> = ({ history, technicalData, color, scrubIndex }) => {
  if (!history || history.length === 0) return <Text style={styles.errorText}>No chart data available</Text>;

  const chartWidth = width;
  const drawingWidth = chartWidth - 60;
  const mainChartHeight = 200;
  const subChartHeight = 80;

  let maxIdx = 0;
  let minIdx = 0;
  if (history.length > 0) {
    history.forEach((q, i) => {
      if (q.close > history[maxIdx].close) maxIdx = i;
      if (q.close < history[minIdx].close) minIdx = i;
    });
  }
  const minPrice = history[minIdx]?.close || 0;
  const maxPrice = history[maxIdx]?.close || 1;
  const priceRange = maxPrice - minPrice || 1;
  const pad = priceRange * 0.15;
  const scaledMinPrice = minPrice - pad;
  const scaledMaxPrice = maxPrice + pad;
  const priceDiff = scaledMaxPrice - scaledMinPrice;
  
  const getY = (p: number) => mainChartHeight - ((p - scaledMinPrice) / priceDiff) * mainChartHeight;
  const stepX = drawingWidth / (history.length - 1 || 1);

  // Compute SMA 14 and RSI 14 based on history
  const period = 14;
  const { computedSma, computedRsi } = useMemo(() => {
    const sma: (number | null)[] = [];
    const rsi: (number | null)[] = [];
    for (let i = 0; i < history.length; i++) {
      if (i < period - 1) {
        sma.push(null);
        rsi.push(null);
        continue;
      }
      
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += history[i - j].close;
      }
      sma.push(sum / period);

      let gains = 0;
      let losses = 0;
      for (let j = 0; j < period; j++) {
        const diff = history[i - j].close - (history[i - j - 1]?.close || history[i - j].close);
        if (diff > 0) gains += diff;
        else losses -= diff;
      }
      const avgGain = gains / period;
      const avgLoss = losses / period;
      if (avgLoss === 0) rsi.push(100);
      else {
        const rs = avgGain / avgLoss;
        rsi.push(100 - (100 / (1 + rs)));
      }
    }
    return { computedSma: sma, computedRsi: rsi };
  }, [history]);

  const validSma = computedSma.filter(v => v !== null) as number[];
  const validRsi = computedRsi.filter(v => v !== null) as number[];
  
  let latestSma = validSma.length > 0 ? validSma[validSma.length - 1].toFixed(2) : 'N/A';
  let latestRsi = validRsi.length > 0 ? validRsi[validRsi.length - 1].toFixed(2) : 'N/A';

  const { pricePath, gradientPath, smaPath, rsiPath } = useMemo(() => {
    const pPath = Skia.Path.Make();
    const gPath = Skia.Path.Make();
    const sPath = Skia.Path.Make();
    const rPath = Skia.Path.Make();

    history.forEach((quote, i) => {
      const x = i * stepX;
      const y = getY(quote.close);
      if (i === 0) {
        pPath.moveTo(x, y);
        gPath.moveTo(x, y);
      } else {
        pPath.lineTo(x, y);
        gPath.lineTo(x, y);
      }
    });

    gPath.lineTo(chartWidth, mainChartHeight);
    gPath.lineTo(0, mainChartHeight);
    gPath.close();

    // Plot computed SMA
    let smaStarted = false;
    computedSma.forEach((val, i) => {
      if (val !== null) {
        const x = i * stepX;
        const y = getY(val);
        if (!smaStarted) {
          sPath.moveTo(x, y);
          smaStarted = true;
        } else {
          sPath.lineTo(x, y);
        }
      }
    });

    // Plot computed RSI
    let rsiStarted = false;
    computedRsi.forEach((val, i) => {
      if (val !== null) {
        const x = i * stepX;
        const y = subChartHeight - (val / 100) * subChartHeight;
        if (!rsiStarted) {
          rPath.moveTo(x, y);
          rsiStarted = true;
        } else {
          rPath.lineTo(x, y);
        }
      }
    });

    return { pricePath: pPath, gradientPath: gPath, smaPath: sPath, rsiPath: rPath };
  }, [history, technicalData, minPrice, priceDiff, stepX, chartWidth, mainChartHeight, subChartHeight]);

  return (
    <View style={styles.container}>
      {scrubIndex !== null && (
        <View style={[styles.scrubIndicator, { left: scrubIndex * stepX }]} pointerEvents="none">
          <View style={[styles.scrubLine, { height: mainChartHeight + subChartHeight + 20, backgroundColor: theme.colors.textSecondary }]} />
          <View style={styles.scrubDot} />
        </View>
      )}

      {/* Main Price Chart */}
      <View style={styles.chartWrapper}>
        <Canvas style={{ width: chartWidth, height: mainChartHeight }} pointerEvents="none">
          <Path path={gradientPath}>
            <SkiaLinearGradient
              start={vec(0, 0)}
              end={vec(0, mainChartHeight)}
              colors={[`${color}80`, `${color}00`]}
            />
          </Path>
          <Path path={pricePath} style="stroke" strokeWidth={2} color={color} />
          <Path path={smaPath} style="stroke" strokeWidth={1.5} color="#ffb74d" />
        </Canvas>
        <Text style={[styles.overlayText, { color: '#ffb74d' }]}>SMA(14): {latestSma}</Text>
        {/* Fixed Y Axis Prices & Grid */}
        <Text style={[styles.axisText, { top: 0 }]}>{scaledMaxPrice.toFixed(2)}</Text>
        <Text style={[styles.axisText, { top: mainChartHeight / 2 - 7 }]}>{((scaledMaxPrice + scaledMinPrice) / 2).toFixed(2)}</Text>
        <Text style={[styles.axisText, { top: mainChartHeight - 15 }]}>{scaledMinPrice.toFixed(2)}</Text>
        <View style={[styles.gridLine, { top: mainChartHeight / 2, width: drawingWidth }]} />

        {/* High / Low Intersecting Markers */}
        {history.length > 0 && (() => {
          const highY = getY(maxPrice);
          const lowY = getY(minPrice);
          const maxDateLeft = Math.max(0, Math.min((maxIdx * stepX) - 20, drawingWidth - 40));
          const minDateLeft = Math.max(0, Math.min((minIdx * stepX) - 20, drawingWidth - 40));
          const datesOverlap = Math.abs(maxDateLeft - minDateLeft) < 45;
          
          const showStartX = maxIdx * stepX > 50 && minIdx * stepX > 50;
          const showEndX = maxIdx * stepX < drawingWidth - 50 && minIdx * stepX < drawingWidth - 50;
          const showMidX = Math.abs(maxIdx * stepX - drawingWidth / 2) > 40 && Math.abs(minIdx * stepX - drawingWidth / 2) > 40;

          return (
            <>
              {/* HIGH */}
              <View style={[styles.highlightLine, { left: maxIdx * stepX, height: mainChartHeight }]} />
              <View style={[styles.highlightLineHorizontal, { top: highY, width: drawingWidth }]} />
              
              <Text style={[styles.axisXText, { left: maxDateLeft, top: highY - 15, color: theme.colors.success }]}>
                {new Date(history[maxIdx].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </Text>
              
              <Text style={[styles.axisText, { top: highY - 7, color: theme.colors.success }]}>
                {maxPrice.toFixed(2)}
              </Text>

              {/* LOW */}
              <View style={[styles.highlightLine, { left: minIdx * stepX, height: mainChartHeight }]} />
              <View style={[styles.highlightLineHorizontal, { top: lowY, width: drawingWidth }]} />
              
              <Text style={[styles.axisXText, { left: minDateLeft, top: lowY + 5, color: theme.colors.danger }]}>
                {new Date(history[minIdx].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </Text>
              
              <Text style={[styles.axisText, { top: lowY - 7, color: theme.colors.danger }]}>
                {minPrice.toFixed(2)}
              </Text>

              {/* Fixed X Axis Dates (Positioned at bottom boundary) */}
              {showStartX && (
                <Text style={[styles.axisXText, { top: mainChartHeight + 5, left: 0 }]}>
                  {new Date(history[0].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </Text>
              )}
              {showMidX && (
                <Text style={[styles.axisXText, { top: mainChartHeight + 5, left: drawingWidth / 2 - 20, textAlign: 'center' }]}>
                  {new Date(history[Math.floor(history.length / 2)].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </Text>
              )}
              {showEndX && (
                <Text style={[styles.axisXText, { top: mainChartHeight + 5, left: drawingWidth - 40 }]}>
                  {new Date(history[history.length - 1].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </Text>
              )}
            </>
          );
        })()}
      </View>

      {/* Sub Chart RSI */}
      <View style={styles.subChartWrapper}>
        <Canvas style={{ width: chartWidth, height: subChartHeight }} pointerEvents="none">
           <Path path={rsiPath} style="stroke" strokeWidth={1.5} color="#4fc3f7" />
           {/* 70 and 30 lines */}
           {(() => {
             const line70 = Skia.Path.Make();
             line70.moveTo(0, subChartHeight - (70/100) * subChartHeight);
             line70.lineTo(chartWidth, subChartHeight - (70/100) * subChartHeight);
             const line30 = Skia.Path.Make();
             line30.moveTo(0, subChartHeight - (30/100) * subChartHeight);
             line30.lineTo(chartWidth, subChartHeight - (30/100) * subChartHeight);
             return (
               <>
                 <Path path={line70} style="stroke" strokeWidth={1} color="#333" />
                 <Path path={line30} style="stroke" strokeWidth={1} color="#333" />
               </>
             )
           })()}
        </Canvas>
        <Text style={[styles.overlayText, { color: '#4fc3f7' }]}>RSI(14): {latestRsi}</Text>
        {/* RSI Axes */}
        <Text style={[styles.axisText, { top: 10, color: '#666' }]}>70</Text>
        <Text style={[styles.axisText, { top: subChartHeight - 20, color: '#666' }]}>30</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    backgroundColor: '#0a0a0a',
  },
  chartWrapper: {
    height: 200,
    position: 'relative',
  },
  subChartWrapper: {
    height: 80,
    marginTop: 10,
    position: 'relative',
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
    paddingTop: 10,
  },
  scrubIndicator: {
    position: 'absolute',
    top: 0,
    zIndex: 10,
    alignItems: 'center',
    transform: [{ translateX: -5 }]
  },
  scrubLine: {
    width: 1,
  },
  scrubDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.text,
    position: 'absolute',
    top: -5,
  },
  overlayText: {
    position: 'absolute',
    top: 5,
    left: 10,
    fontSize: 12,
    fontWeight: 'bold',
    opacity: 0.9
  },
  axisText: {
    position: 'absolute',
    right: 10,
    fontSize: 10,
    color: '#888',
    fontWeight: '600',
  },
  axisXText: {
    position: 'absolute',
    fontSize: 10,
    color: '#888',
    fontWeight: '600',
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#333',
    borderStyle: 'dashed',
    opacity: 0.3,
  },
  highlightLine: {
    position: 'absolute',
    width: 1,
    backgroundColor: '#aaa',
    borderStyle: 'dashed',
    opacity: 0.4,
  },
  highlightLineHorizontal: {
    position: 'absolute',
    height: 1,
    backgroundColor: '#aaa',
    borderStyle: 'dashed',
    opacity: 0.4,
  },
  highlightText: {
    position: 'absolute',
    fontSize: 9,
    color: '#aaa',
    fontWeight: 'bold',
  },
  errorText: {
    color: theme.colors.textSecondary,
    textAlign: 'center',
    padding: 20
  }
});
