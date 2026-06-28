import 'react-native-reanimated';
import { registerRootComponent } from 'expo';
import { View, Text } from 'react-native';
import React from 'react';
import { WithSkiaWeb } from '@shopify/react-native-skia/lib/module/web';

import App from './App';

const Root = () => {
  return (
    <WithSkiaWeb 
      getComponent={() => App} 
      fallback={<View style={{flex: 1, backgroundColor: '#09090b', justifyContent: 'center', alignItems: 'center'}}><Text style={{color: '#fafafa'}}>Loading Skia for Web...</Text></View>} 
    />
  );
};

registerRootComponent(Root);
