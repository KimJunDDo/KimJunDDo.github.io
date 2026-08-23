---
title: "React Native에서 Liquid Glass 적용하기"
date: 2026-08-23
draft: false
description: "iOS 26의 Liquid Glass를 React Native와 Expo에서 적용하는 방법과 호환성, 접근성, 성능 주의사항을 정리합니다."
tags: ["React Native", "Expo", "iOS 26", "Liquid Glass"]
categories: ["React Native"]
showTableOfContents: true
---

Apple은 iOS 26에서 새로운 인터페이스 재질인 **Liquid Glass**를 도입했다. 이름만 보면 기존의 `blur`나 반투명 배경과 비슷해 보이지만, 실제로는 뒤쪽 콘텐츠의 색과 빛을 반영하고 사용자 입력에 반응하며 여러 유리 요소가 가까워질 때 형태가 합쳐지는 네이티브 렌더링 효과다.

React Native에서 Liquid Glass를 적용할 때 가장 먼저 알아야 할 점은 다음과 같다.

{{< conclusion >}}
**Liquid Glass는 단순한 JavaScript 스타일이 아니다.** React Native의 일반 `View`에 투명도와 blur를 적용하는 것만으로 동일한 결과를 만들 수 없으며, iOS가 제공하는 네이티브 컴포넌트를 사용해야 한다.
{{< /conclusion >}}

이 글에서는 Expo 기반 React Native 프로젝트를 중심으로 Liquid Glass를 적용하는 방법과 실제 서비스에서 확인해야 할 호환성 문제를 정리한다.

## Liquid Glass란?

Apple은 Liquid Glass를 유리의 광학적 특성과 유동적인 움직임을 결합한 동적 재질로 설명한다. 단순히 배경을 흐리게 만드는 것이 아니라 다음 요소가 함께 동작한다.

- 뒤쪽 콘텐츠의 색상과 빛을 반영한다.
- 터치와 포인터 입력에 실시간으로 반응한다.
- 주변 콘텐츠와 명암에 따라 가독성을 조절한다.
- 여러 유리 요소가 가까워지면 하나의 형태처럼 결합될 수 있다.
- 화면 전환 과정에서 유리 형태가 자연스럽게 변형될 수 있다.

SwiftUI에서는 `glassEffect(_:in:)`로 개별 효과를 적용하고, 여러 요소를 함께 렌더링할 때 `GlassEffectContainer`를 사용한다. Apple은 컨테이너를 사용하면 렌더링 성능을 높이고 요소 사이의 결합 및 morphing 효과를 만들 수 있다고 안내한다.

또한 `NavigationStack`, `UITabBar`, `Toolbar`, `Sheet`처럼 시스템이 제공하는 표준 컴포넌트는 최신 SDK로 빌드하고 iOS 26에서 실행하면 새로운 디자인을 자동으로 적용할 수 있다.

## React Native에서 적용하는 세 가지 방법

React Native에서는 적용하려는 UI의 종류에 따라 접근 방법을 선택하는 것이 좋다.

| 적용 대상 | 권장 방법 | 특징 |
| --- | --- | --- |
| 헤더, 탭, 시트 | Expo Router 또는 React Navigation의 네이티브 컴포넌트 | 운영체제 디자인을 자동으로 반영하기 좋다. |
| 카드, 버튼, 플로팅 컨트롤 | `expo-glass-effect` | 기존 React Native 화면에 부분적으로 적용하기 쉽다. |
| SwiftUI 기반 화면과 복잡한 전환 | `@expo/ui/swift-ui` | SwiftUI modifier와 컨테이너를 React 방식으로 사용한다. |

가장 중요한 기준은 **네이티브 시스템 컴포넌트로 해결할 수 있는지를 먼저 확인하는 것**이다. Apple 역시 탭 바와 툴바에 별도의 배경을 덧씌우기보다 시스템이 제공하는 효과를 활용할 것을 권장한다.

## 방법 1. expo-glass-effect로 커스텀 카드 만들기

기존 Expo 프로젝트의 특정 카드나 버튼에 Liquid Glass를 적용하려면 `expo-glass-effect`가 가장 직접적인 선택이다. 이 패키지는 iOS의 네이티브 시각 효과를 React 컴포넌트로 제공한다.

### 설치

```bash
npx expo install expo-glass-effect
```

Bare React Native 프로젝트에서도 사용할 수 있지만, Expo 모듈을 사용하도록 프로젝트가 구성되어 있어야 한다. `expo install`을 사용하면 현재 Expo SDK와 호환되는 버전을 선택해 준다.

### 기본 GlassView

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
        <Text style={styles.title}>{'오늘의 여행지'}</Text>
        <Text style={styles.description}>
          {'배경 콘텐츠 위에 네이티브 유리 효과를 표시합니다.'}
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

`glassEffectStyle`은 `regular`, `clear`, `none` 또는 애니메이션 설정 객체를 받을 수 있다. `isInteractive`를 켜면 터치에 반응하는 네이티브 효과를 사용할 수 있고, `tintColor`로 시각적 중요도를 조절할 수 있다.

### 지원 여부를 확인하고 fallback 제공하기

`GlassView`의 실제 Liquid Glass 효과는 iOS 26 이상에서 사용할 수 있다. 지원하지 않는 환경에서는 일반 `View`로 대체되지만, 제품 UI에서는 명시적으로 지원 여부와 접근성 설정을 확인하고 fallback 스타일을 준비하는 편이 안전하다.

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

여기서 두 함수를 구분할 필요가 있다.

- `isGlassEffectAPIAvailable()`은 현재 기기에 네이티브 Glass API가 실제로 존재하는지 확인한다.
- `isLiquidGlassAvailable()`은 시스템 버전, 컴파일러 및 앱 설정을 포함해 현재 빌드에서 Liquid Glass 컴포넌트를 사용할 수 있는지 확인한다.
- `AccessibilityInfo.isReduceTransparencyEnabled()`는 사용자가 투명도 감소 옵션을 켰는지 확인한다.

Android와 구형 iOS에서도 정보 구조와 터치 영역은 동일해야 한다. 효과가 빠졌다는 이유로 버튼의 위치나 크기가 달라지면 안 된다.

## 방법 2. 네이티브 헤더와 탭 사용하기

헤더나 탭 바 전체를 Liquid Glass로 만들고 싶다면 커스텀 `View`를 겹쳐 그리는 것보다 네이티브 내비게이션을 사용하는 편이 자연스럽다.

Expo Router의 네이티브 Stack 헤더는 iOS 26에서 시스템 Liquid Glass 디자인을 사용한다. 이 효과는 화면별로 끌 수 없으며, 꼭 제거해야 한다면 앱 전체 호환성 설정을 사용하거나 JavaScript 기반 Stack으로 교체해야 한다. 다만 Apple의 호환성 설정은 임시 수단이므로 새 UI에 맞춰 화면을 정리하는 방향이 장기적으로 안전하다.

Expo Router의 Native Tabs도 iOS에서 네이티브 탭 바를 사용한다.

```tsx
import { NativeTabs } from 'expo-router/unstable-native-tabs';

export default function TabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{'홈'}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>{'설정'}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
```

Native Tabs는 네이티브 시스템 탭을 사용하므로 iOS 26에서는 Liquid Glass를 반영하고 Android에서는 Android의 네이티브 탭으로 표시된다. 다만 현재 공식 문서에서 alpha API로 안내하고 있으므로 업데이트 시 변경사항을 확인해야 한다.

React Navigation을 직접 사용한다면 JavaScript 기반 Bottom Tabs가 아니라 **Native Bottom Tabs**를 선택해야 iOS 26의 네이티브 Liquid Glass 스타일을 활용할 수 있다. 실제 효과를 보려면 Xcode 26 이상으로 앱을 빌드해야 한다.

## 방법 3. Expo UI와 SwiftUI modifier 사용하기

단순한 유리 카드보다 SwiftUI의 레이아웃과 modifier를 적극적으로 사용하고 싶다면 `@expo/ui/swift-ui`를 고려할 수 있다. Expo UI는 SwiftUI 컴포넌트를 React의 컴포넌트 모델로 노출한다.

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

여러 요소의 유리 형태가 합쳐지거나 화면 전환 중 morphing되는 효과까지 필요하다면 SwiftUI의 `GlassEffectContainer`와 식별자 기반 modifier가 적합하다. 반대로 기존 React Native 화면에 카드 한두 개만 추가하려는 경우에는 `expo-glass-effect`가 더 단순하다.

## 자주 발생하는 문제

### opacity를 0으로 애니메이션하면 효과가 사라진다

Expo 공식 문서에는 `GlassView` 또는 부모 뷰의 `opacity`를 `0`으로 설정하면 유리 효과가 렌더링되지 않는 문제가 명시되어 있다. 유리 효과를 숨기거나 나타낼 때는 부모의 투명도를 직접 변경하기보다 `glassEffectStyle`의 네이티브 애니메이션 설정을 사용하는 것이 권장된다.

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

### 배경이 없으면 유리처럼 보이지 않는다

Liquid Glass는 뒤쪽 콘텐츠를 반영한다. 단색 배경 위에 올리면 효과가 약하게 느껴질 수 있다. 이미지, 그라데이션, 스크롤 콘텐츠처럼 시각적인 변화가 있는 배경 위에서 확인해야 한다.

하지만 효과를 강조하려고 배경을 지나치게 복잡하게 만들면 텍스트 가독성이 떨어질 수 있다. 라이트 모드와 다크 모드, 다양한 이미지 위에서 명암을 함께 테스트해야 한다.

### 커스텀 배경이 네이티브 효과를 가린다

기존 앱에서 탭 바나 헤더에 `backgroundColor` 또는 별도의 blur layer를 적용했다면 시스템 Liquid Glass와 겹칠 수 있다. 최신 SDK로 먼저 빌드해 본 뒤, 네이티브 바 위에 덧씌운 배경과 그림자를 제거하면서 확인하는 것이 좋다.

### 시뮬레이터 한 가지 상태만 보면 부족하다

최소한 다음 조건을 확인해야 한다.

- iOS 26 실제 기기와 시뮬레이터
- iOS 25 이하 fallback
- Android fallback
- 라이트 모드와 다크 모드
- 투명도 감소 설정
- 동작 줄이기 설정
- 밝고 복잡한 배경 위의 텍스트 대비
- 빠른 스크롤과 화면 전환 중 프레임 저하

## 실무 적용 순서

Liquid Glass를 프로젝트 전체에 한 번에 적용하기보다 다음 순서로 접근하는 것이 안전하다.

1. Xcode 26 이상으로 기존 앱을 빌드하고 네이티브 헤더, 탭, 시트가 어떻게 바뀌는지 확인한다.
2. 네이티브 컴포넌트 위에 적용했던 커스텀 배경과 blur를 점검한다.
3. 중요한 플로팅 버튼이나 카드에만 `expo-glass-effect`를 적용한다.
4. 구형 iOS와 Android에서 사용할 fallback 스타일을 만든다.
5. 투명도 감소와 동작 줄이기 접근성 설정을 테스트한다.
6. 여러 Glass 요소가 필요할 때만 `GlassContainer` 또는 Expo UI를 도입한다.

{{< conclusion >}}
**결론:** React Native에서 Liquid Glass를 적용할 때는 먼저 네이티브 헤더·탭·시트를 활용하고, 커스텀 요소에만 `expo-glass-effect`를 제한적으로 사용하는 구성이 가장 현실적이다. iOS 26 전용 시각 효과로 끝내지 말고 Android, 구형 iOS, 투명도 감소 환경의 fallback까지 하나의 UI로 설계해야 한다.
{{< /conclusion >}}

## 참고 자료

- [Apple Developer - Adopting Liquid Glass](https://developer.apple.com/documentation/TechnologyOverviews/adopting-liquid-glass)
- [Apple Developer - Applying Liquid Glass to custom views](https://developer.apple.com/documentation/SwiftUI/Applying-Liquid-Glass-to-custom-views)
- [Expo Documentation - GlassEffect](https://docs.expo.dev/versions/latest/sdk/glass-effect/)
- [Expo Documentation - Building SwiftUI apps with Expo UI](https://docs.expo.dev/guides/expo-ui-swift-ui/)
- [Expo Router - Native tabs](https://docs.expo.dev/router/advanced/native-tabs/)
- [Expo Router - Stack과 iOS 26 Liquid Glass 헤더](https://docs.expo.dev/router/advanced/stack/)
- [React Navigation - Native Bottom Tabs](https://reactnavigation.org/docs/native-bottom-tab-navigator/)
- [React Native - AccessibilityInfo](https://reactnative.dev/docs/accessibilityinfo)
