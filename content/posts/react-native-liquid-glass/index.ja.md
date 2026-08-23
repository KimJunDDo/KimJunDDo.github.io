---
title: "React NativeでLiquid Glassを実装する"
date: 2026-08-23
draft: false
description: "iOS 26のLiquid GlassをReact NativeとExpoで実装する方法と、互換性・アクセシビリティ・パフォーマンス上の注意点を整理します。"
tags: ["React Native", "Expo", "iOS 26", "Liquid Glass"]
categories: ["React Native"]
showTableOfContents: true
---

AppleはiOS 26で、新しいインターフェース素材である**Liquid Glass**を導入した。名前だけを見ると従来の`blur`や半透明の背景と似ているように思えるが、実際には背後のコンテンツの色や光を反映し、ユーザーの入力に反応しながら、複数のガラス要素が近づくと形状が結合するネイティブレンダリング効果である。

React NativeでLiquid Glassを実装するとき、最初に理解しておきたい点は次のとおりだ。

{{< conclusion >}}
**Liquid Glassは単なるJavaScriptのスタイルではない。** React Nativeの通常の`View`に透明度とblurを指定するだけでは同じ結果にならず、iOSが提供するネイティブコンポーネントを利用する必要がある。
{{< /conclusion >}}

この記事ではExpoベースのReact Nativeプロジェクトを中心に、Liquid Glassの実装方法と、実際のサービスで確認すべき互換性の問題を整理する。

## Liquid Glassとは

AppleはLiquid Glassを、ガラスの光学的な性質と流動的な動きを組み合わせた動的素材として説明している。単に背景をぼかすだけではなく、次の要素が連動する。

- 背後にあるコンテンツの色や光を反映する。
- タッチやポインター入力にリアルタイムで反応する。
- 周囲のコンテンツや明暗に応じて可読性を調整する。
- 複数のガラス要素が近づくと、一つの形状のように結合できる。
- 画面遷移中にガラスの形状を自然に変形できる。

SwiftUIでは`glassEffect(_:in:)`で個別の効果を適用し、複数の要素をまとめてレンダリングするときは`GlassEffectContainer`を使用する。Appleは、コンテナを利用することでレンダリング性能を高め、要素同士の結合やmorphing効果を実現できると案内している。

また、`NavigationStack`、`UITabBar`、`Toolbar`、`Sheet`など、システムが提供する標準コンポーネントは、最新のSDKでビルドしてiOS 26上で実行すると新しいデザインを自動的に取り入れることができる。

## React Nativeで実装する三つの方法

React Nativeでは、適用したいUIの種類に応じて実装方法を選ぶとよい。

| 適用対象 | 推奨方法 | 特徴 |
| --- | --- | --- |
| ヘッダー、タブ、シート | Expo RouterまたはReact Navigationのネイティブコンポーネント | OSのデザインを自動的に反映しやすい。 |
| カード、ボタン、フローティングコントロール | `expo-glass-effect` | 既存のReact Native画面に部分的に導入しやすい。 |
| SwiftUIベースの画面と複雑な遷移 | `@expo/ui/swift-ui` | SwiftUIのmodifierとコンテナをReactの形式で使用できる。 |

最も重要な判断基準は、**ネイティブのシステムコンポーネントだけで解決できるかを先に確認すること**である。Appleも、タブバーやツールバーに独自の背景を重ねるより、システムが提供する効果を利用することを推奨している。

## 方法1. expo-glass-effectでカスタムカードを作る

既存のExpoプロジェクトにある特定のカードやボタンへLiquid Glassを適用するなら、`expo-glass-effect`が最も直接的な選択肢である。このパッケージはiOSのネイティブ視覚効果をReactコンポーネントとして提供する。

### インストール

```bash
npx expo install expo-glass-effect
```

Bare React Nativeプロジェクトでも利用できるが、Expo Modulesを使用できるようにプロジェクトを構成する必要がある。`expo install`を使うと、現在のExpo SDKと互換性のあるバージョンが選択される。

### 基本的なGlassView

```tsx
import { Image, StyleSheet, Text, View } from 'react-native';
import { GlassView } from 'expo-glass-effect';

export default function GlassCardExample() {
  return (
    <View style={styles.screen}>
      <Image
        source={require('./assets/background.jpg')}
        style={StyleSheet.absoluteFillObject}
        resizeMode="cover"
      />

      <GlassView
        style={styles.card}
        glassEffectStyle="regular"
        tintColor="rgba(255, 255, 255, 0.12)"
        isInteractive
      >
        <Text style={styles.title}>{'今日の旅行先'}</Text>
        <Text style={styles.description}>
          {'背景コンテンツの上にネイティブのガラス効果を表示します。'}
        </Text>
      </GlassView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 24,
  },
  card: {
    minHeight: 150,
    padding: 20,
    borderRadius: 24,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  title: {
    color: '#111827',
    fontSize: 22,
    fontWeight: '700',
  },
  description: {
    color: '#374151',
    marginTop: 8,
    lineHeight: 21,
  },
});
```

`glassEffectStyle`には`regular`、`clear`、`none`、またはアニメーション設定オブジェクトを指定できる。`isInteractive`を有効にするとタッチに反応するネイティブ効果を利用でき、`tintColor`で視覚的な強調度を調整できる。

### 対応状況を確認してfallbackを用意する

`GlassView`の実際のLiquid Glass効果はiOS 26以降で利用できる。未対応環境では通常の`View`へfallbackするが、製品のUIでは対応状況とアクセシビリティ設定を明示的に確認し、fallback用のスタイルを用意しておく方が安全である。

```tsx
import { useEffect, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import {
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from 'expo-glass-effect';

type AdaptiveGlassProps = {
  children: ReactNode;
};

export function AdaptiveGlass({ children }: AdaptiveGlassProps) {
  const [reduceTransparency, setReduceTransparency] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceTransparencyEnabled()
      .then(setReduceTransparency);

    const subscription = AccessibilityInfo.addEventListener(
      'reduceTransparencyChanged',
      setReduceTransparency,
    );

    return () => subscription.remove();
  }, []);

  const canUseLiquidGlass =
    Platform.OS === 'ios' &&
    isGlassEffectAPIAvailable() &&
    isLiquidGlassAvailable() &&
    !reduceTransparency;

  if (!canUseLiquidGlass) {
    return <View style={[styles.card, styles.fallback]}>{children}</View>;
  }

  return (
    <GlassView
      style={styles.card}
      glassEffectStyle="regular"
      isInteractive
    >
      {children}
    </GlassView>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 120,
    padding: 20,
    borderRadius: 24,
    overflow: 'hidden',
  },
  fallback: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
});
```

ここでは二つの関数の役割を区別する必要がある。

- `isGlassEffectAPIAvailable()`は、現在の端末にネイティブGlass APIが実際に存在するかを確認する。
- `isLiquidGlassAvailable()`は、システムバージョン、コンパイラ、アプリ設定を含め、現在のビルドでLiquid Glassコンポーネントが利用できるかを確認する。
- `AccessibilityInfo.isReduceTransparencyEnabled()`は、ユーザーが「透明度を下げる」を有効にしているかを確認する。

Androidや古いiOSでも、情報構造とタップ領域は同じでなければならない。効果が適用されないという理由でボタンの位置や大きさが変わらないようにする。

## 方法2. ネイティブヘッダーとタブを使う

ヘッダーやタブバー全体をLiquid Glassにしたい場合、カスタム`View`を重ねて描画するより、ネイティブナビゲーションを使う方が自然である。

Expo RouterのネイティブStackヘッダーは、iOS 26でシステムのLiquid Glassデザインを使用する。この効果は画面単位では無効にできない。どうしても取り除く必要がある場合はアプリ全体の互換性設定を使用するか、JavaScriptベースのStackへ交換する。ただしAppleの互換性設定は一時的な手段であるため、長期的には新しいUIへ合わせて画面を整理する方が安全である。

Expo RouterのNative TabsもiOSではネイティブタブバーを使用する。

```tsx
import { NativeTabs } from 'expo-router/unstable-native-tabs';

export default function TabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{'ホーム'}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>{'設定'}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
```

Native Tabsはネイティブのシステムタブを使うため、iOS 26ではLiquid Glassが反映され、AndroidではAndroidのネイティブタブとして表示される。ただし、現在の公式ドキュメントではalpha APIとして案内されているため、アップデート時には変更点を確認する必要がある。

React Navigationを直接使う場合は、JavaScriptベースのBottom Tabsではなく**Native Bottom Tabs**を選択することで、iOS 26のネイティブLiquid Glassスタイルを利用できる。実際の効果を確認するにはXcode 26以降でアプリをビルドする必要がある。

## 方法3. Expo UIとSwiftUI modifierを使う

単純なガラスカードだけでなく、SwiftUIのレイアウトやmodifierを積極的に使いたい場合は`@expo/ui/swift-ui`を検討できる。Expo UIはSwiftUIコンポーネントをReactのコンポーネントモデルとして公開する。

```tsx
import { Host, Text } from '@expo/ui/swift-ui';
import {
  glassEffect,
  padding,
} from '@expo/ui/swift-ui/modifiers';

export function SwiftUIGlassLabel() {
  return (
    <Host matchContents>
      <Text
        modifiers={[
          padding({ all: 16 }),
          glassEffect({
            glass: {
              variant: 'regular',
              interactive: true,
            },
            shape: 'roundedRectangle',
            cornerRadius: 18,
          }),
        ]}
      >
        Liquid Glass
      </Text>
    </Host>
  );
}
```

複数要素のガラス形状を結合したり、画面遷移中にmorphingさせたりする必要がある場合は、SwiftUIの`GlassEffectContainer`と識別子ベースのmodifierが適している。一方、既存のReact Native画面にカードを一つか二つ追加するだけなら、`expo-glass-effect`の方が単純である。

## よく発生する問題

### opacityを0にすると効果が消える

Expoの公式ドキュメントには、`GlassView`または親Viewの`opacity`を`0`にするとガラス効果がレンダリングされなくなる問題が明記されている。ガラス効果を表示・非表示にするときは、親の透明度を直接変更するのではなく、`glassEffectStyle`のネイティブアニメーション設定を使うことが推奨されている。

```tsx
<GlassView
  style={styles.card}
  glassEffectStyle={{
    style: visible ? 'regular' : 'none',
    animate: true,
    animationDuration: 0.25,
  }}
/>
```

### 背景がなければガラスらしく見えない

Liquid Glassは背後のコンテンツを反映する。単色背景の上では効果が弱く感じられることがあるため、画像、グラデーション、スクロールコンテンツのように視覚的な変化がある背景の上で確認する必要がある。

ただし、効果を強調するために背景を複雑にしすぎると、テキストの可読性が下がる。ライトモードとダークモード、さまざまな画像の上でコントラストをテストする。

### カスタム背景がネイティブ効果を隠す

既存アプリのタブバーやヘッダーに`backgroundColor`や独自のblur layerを適用している場合、システムのLiquid Glassと重なる可能性がある。まず最新SDKでビルドし、ネイティブバーの上に重ねていた背景や影を取り除きながら確認するとよい。

### 一つのシミュレーター状態だけでは不十分

最低限、次の条件を確認する。

- iOS 26の実機とシミュレーター
- iOS 25以前のfallback
- Androidのfallback
- ライトモードとダークモード
- 「透明度を下げる」設定
- 「視差効果を減らす」設定
- 明るく複雑な背景上でのテキストコントラスト
- 高速スクロールと画面遷移中のフレーム低下

## 実務での導入手順

Liquid Glassをプロジェクト全体へ一度に適用するのではなく、次の順序で進めると安全である。

1. Xcode 26以降で既存アプリをビルドし、ネイティブヘッダー、タブ、シートがどのように変わるか確認する。
2. ネイティブコンポーネントの上に設定していたカスタム背景やblurを点検する。
3. 重要なフローティングボタンやカードだけに`expo-glass-effect`を適用する。
4. 古いiOSとAndroid向けのfallbackスタイルを用意する。
5. 「透明度を下げる」と「視差効果を減らす」のアクセシビリティ設定をテストする。
6. 複数のGlass要素が必要な場合にだけ`GlassContainer`またはExpo UIを導入する。

{{< conclusion >}}
**結論:** React NativeでLiquid Glassを導入する際は、まずネイティブのヘッダー・タブ・シートを活用し、カスタム要素にだけ`expo-glass-effect`を限定的に使う構成が現実的である。iOS 26専用の視覚効果だけで終わらせず、Android、古いiOS、「透明度を下げる」環境のfallbackまで一つのUIとして設計する必要がある。
{{< /conclusion >}}

## 参考資料

- [Apple Developer - Adopting Liquid Glass](https://developer.apple.com/documentation/TechnologyOverviews/adopting-liquid-glass)
- [Apple Developer - Applying Liquid Glass to custom views](https://developer.apple.com/documentation/SwiftUI/Applying-Liquid-Glass-to-custom-views)
- [Expo Documentation - GlassEffect](https://docs.expo.dev/versions/latest/sdk/glass-effect/)
- [Expo Documentation - Building SwiftUI apps with Expo UI](https://docs.expo.dev/guides/expo-ui-swift-ui/)
- [Expo Router - Native tabs](https://docs.expo.dev/router/advanced/native-tabs/)
- [Expo Router - StackとiOS 26 Liquid Glassヘッダー](https://docs.expo.dev/router/advanced/stack/)
- [React Navigation - Native Bottom Tabs](https://reactnavigation.org/docs/native-bottom-tab-navigator/)
- [React Native - AccessibilityInfo](https://reactnative.dev/docs/accessibilityinfo)
