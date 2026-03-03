import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Screen({ children, style, edges = ['top', 'left', 'right'] }) {
  return (
    <SafeAreaView edges={edges} style={[{ flex: 1 }, style]}>
      {children}
    </SafeAreaView>
  );
}

