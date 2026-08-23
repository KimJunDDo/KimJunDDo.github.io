# KimJunDDo's Blog 글 작성 가이드

이 문서는 현재 블로그에서 사용하는 게시글 구조와 Markdown 작성 규칙을 정리한 가이드다.

## 1. 게시글 폴더 구조

게시글은 `content/posts/` 아래에 글별 폴더를 만들어 작성한다.

```text
content/posts/
└── react-native-liquid-glass/
    ├── index.ko.md
    ├── index.ja.md
    └── cover.png
```

- 폴더 이름은 글의 URL이 되므로 영문 소문자와 하이픈 사용을 권장한다.
- 한국어 파일은 `index.ko.md`로 작성한다.
- 일본어 번역은 같은 폴더에 `index.ja.md`로 작성한다.
- 두 언어 파일이 같은 폴더에 있어야 KO/JA 언어 전환 버튼이 연결된다.
- 게시글에서 사용하는 이미지는 가능하면 같은 폴더에 넣는다.

예상 URL은 다음과 같다.

```text
한국어: /posts/react-native-liquid-glass/
일본어: /ja/posts/react-native-liquid-glass/
```

## 2. Front matter 작성법

모든 게시글은 파일 상단에 다음 형식의 front matter를 작성한다.

```yaml
---
title: "React Native에서 Liquid Glass 적용하기"
date: 2026-08-23
draft: false
description: "게시글 목록과 검색 결과에 표시할 짧은 설명입니다."
tags: ["React Native", "Expo", "iOS 26", "Liquid Glass"]
categories: ["React Native"]
showTableOfContents: true
---
```

각 항목의 역할은 다음과 같다.

| 항목 | 설명 |
| --- | --- |
| `title` | 게시글 제목 |
| `date` | 작성일. `YYYY-MM-DD` 형식 사용 |
| `draft` | `true`이면 일반 빌드에서 숨김, `false`이면 공개 |
| `description` | 글 목록과 검색 결과 등에 사용할 요약 |
| `tags` | 세부 기술 또는 주제. 여러 개 지정 가능 |
| `categories` | 글의 상위 분류. 현재는 기술명 중심으로 사용 |
| `showTableOfContents` | 오른쪽 목차 표시 여부 |

작성 중인 글은 다음처럼 설정한다.

```yaml
draft: true
```

초안까지 로컬에서 확인할 때는 다음 명령어를 사용한다.

```bash
hugo server -D
```

## 3. 제목과 목차 구조

게시글 제목은 front matter의 `title`이 자동으로 `<h1>`이 되므로 본문에서 `#` 제목은 사용하지 않는다.

```markdown
## 가장 큰 본문 단락

### 단락 안의 세부 주제

#### 더 작은 세부 항목
```

- 목차에는 `##`, `###`, `####` 제목이 표시된다.
- 목차는 데스크톱에서 오른쪽에 표시된다.
- 모바일에서는 접이식 목차로 표시된다.
- 스크롤하면 현재 읽고 있는 목차 항목이 강조된다.
- 제목 단계를 건너뛰지 않는 것이 좋다. 예를 들어 `##` 다음에 바로 `####`를 사용하지 않는다.

## 4. 일반 본문 작성법

문단 사이에는 빈 줄을 한 줄 넣는다.

```markdown
첫 번째 문단입니다.

두 번째 문단입니다.
```

강조는 다음처럼 작성한다.

```markdown
**중요한 내용은 굵게 표시합니다.**

코드, 클래스, 함수 이름은 `GlassView`처럼 표시합니다.

*필요한 경우에만 기울임을 사용합니다.*
```

한 문단 전체를 굵게 작성하면 읽기 어려우므로 핵심 단어나 한 문장 정도만 강조한다.

## 5. 목록 작성법

순서가 중요하지 않은 항목은 글머리표를 사용한다.

```markdown
- iOS 26에서 테스트한다.
- Android fallback을 확인한다.
- 다크 모드를 확인한다.
```

작업 순서처럼 순서가 중요한 내용은 번호 목록을 사용한다.

```markdown
1. 패키지를 설치한다.
2. 컴포넌트를 추가한다.
3. 지원하지 않는 환경의 fallback을 만든다.
```

## 6. 코드 블록 작성법

코드 블록의 시작 부분에 언어 이름을 지정하면 문법 강조가 적용된다.

````markdown
```tsx
import { Text, View } from 'react-native';

export default function App() {
  return (
    <View>
      <Text>{'안녕하세요'}</Text>
    </View>
  );
}
```
````

자주 사용하는 언어 표시는 다음과 같다.

| 코드 종류 | 언어 이름 |
| --- | --- |
| TypeScript React | `tsx` |
| TypeScript | `typescript` 또는 `ts` |
| JavaScript React | `jsx` |
| JavaScript | `javascript` 또는 `js` |
| Java | `java` |
| Python | `python` |
| C | `c` |
| C++ | `cpp` |
| SQL | `sql` |
| JSON | `json` |
| YAML | `yaml` |
| 터미널 명령어 | `bash` 또는 `shell` |

### JSX 안의 한국어와 일본어

Hugo의 문법 강조기가 JSX 태그 사이의 한글이나 일본어를 오류 토큰으로 잘못 판단할 수 있다. 다음처럼 문자열 표현식을 사용하는 것을 권장한다.

```tsx
// 권장
<Text>{'홈'}</Text>
<Text>{'ホーム'}</Text>

// 문법상 유효하지만 문법 강조기가 잘못 표시할 수 있음
<Text>홈</Text>
<Text>ホーム</Text>
```

## 7. 결론 강조 영역

왼쪽에 파란 선이 표시되는 결론 영역은 `conclusion` shortcode를 사용한다.

```markdown
{{< conclusion >}}
**결론:** 네이티브 컴포넌트를 먼저 사용하고, 필요한 부분에만 커스텀 효과를 적용한다.
{{< /conclusion >}}
```

긴 내용을 모두 넣기보다 해당 단락의 핵심을 두세 문장으로 정리한다.

일반 인용문은 기존 Markdown 문법을 사용한다.

```markdown
> 공식 문서에서 가져온 짧은 인용 또는 참고 문장입니다.
```

## 8. 표 작성법

기술 비교나 선택 기준은 표로 정리할 수 있다.

```markdown
| 적용 대상 | 권장 방법 | 특징 |
| --- | --- | --- |
| 헤더와 탭 | 네이티브 내비게이션 | 시스템 디자인 자동 반영 |
| 커스텀 카드 | `expo-glass-effect` | 기존 화면에 부분 적용 가능 |
```

모바일 화면을 고려해 열을 너무 많이 만들거나 한 셀에 긴 문장을 넣지 않는다.

## 9. 링크와 참고자료

링크는 다음처럼 작성한다.

```markdown
[Expo GlassEffect 공식 문서](https://docs.expo.dev/versions/latest/sdk/glass-effect/)
```

인터넷 자료를 조사한 글은 본문 마지막에 `참고 자료` 단락을 추가한다.

```markdown
## 참고 자료

- [Apple Developer - Adopting Liquid Glass](https://developer.apple.com/documentation/TechnologyOverviews/adopting-liquid-glass)
- [Expo Documentation - GlassEffect](https://docs.expo.dev/versions/latest/sdk/glass-effect/)
```

- 기술 문서는 공식 문서와 원본 자료를 우선한다.
- 본문에서 사용한 자료만 참고 목록에 넣는다.
- 다른 글을 긴 문장 그대로 복사하지 않고 내용을 이해한 뒤 자신의 문장으로 정리한다.
- 버전이나 지원 환경처럼 바뀔 수 있는 정보는 작성 시점을 함께 고려한다.

## 10. 이미지 넣는 방법

이미지는 게시글의 Markdown 파일과 같은 폴더에 넣고 상대 경로로 사용한다.

```text
content/posts/example-post/
├── index.ko.md
├── index.ja.md
├── architecture.png
└── cover.png
```

본문에는 다음처럼 작성한다.

```markdown
![React Native 애플리케이션 구조](architecture.png)
```

- 대체 텍스트에는 이미지의 의미를 작성한다.
- 파일명은 영문 소문자와 하이픈 사용을 권장한다.
- 불필요하게 큰 이미지는 업로드 전에 크기를 줄인다.
- `cover`, `feature`, `thumbnail`이 포함된 파일명은 대표 이미지로 인식될 수 있다.

## 11. 한국어와 일본어 번역 규칙

한국어와 일본어 글은 같은 폴더에 작성한다.

```text
index.ko.md
index.ja.md
```

두 파일에서 다음 항목을 동일하게 유지한다.

- `date`
- 기술 태그
- 카테고리
- 제목 단계와 전체 문서 구조
- 코드 예제의 동작
- 참고자료 링크

다음 항목은 자연스럽게 번역한다.

- `title`
- `description`
- 본문
- 이미지 대체 텍스트
- 코드 예제 안에서 사용자에게 표시되는 문구

일본어 글도 카테고리를 동일하게 유지하면 두 언어에서 같은 기술 분류를 사용할 수 있다.

```yaml
categories: ["React Native"]
```

## 12. 복사해서 사용하는 한국어 템플릿

````markdown
---
title: "게시글 제목"
date: 2026-08-23
draft: true
description: "게시글 내용을 한 문장으로 설명합니다."
tags: ["기술 태그", "세부 주제"]
categories: ["상위 카테고리"]
showTableOfContents: true
---

글에서 다룰 문제와 작성 목적을 설명합니다.

{{< conclusion >}}
**핵심:** 글을 읽기 전에 알아야 할 핵심 내용을 간단히 정리합니다.
{{< /conclusion >}}

## 문제 상황

어떤 문제가 있었는지 설명합니다.

## 원인

문제가 발생한 원인을 설명합니다.

### 세부 원인

- 첫 번째 원인
- 두 번째 원인

## 해결 방법

```tsx
export function Example() {
  return null;
}
```

코드가 어떻게 동작하는지 설명합니다.

## 주의사항

1. 지원하는 버전을 확인합니다.
2. 다른 플랫폼의 동작을 확인합니다.
3. 접근성과 성능을 테스트합니다.

{{< conclusion >}}
**결론:** 문제의 원인과 최종 해결 방법을 두세 문장으로 정리합니다.
{{< /conclusion >}}

## 참고 자료

- [공식 문서 이름](https://example.com/)
````

## 13. 작성 후 확인 사항

글을 작성한 뒤 다음 항목을 확인한다.

- [ ] `title`, `date`, `description`을 작성했는가?
- [ ] 태그와 카테고리를 지정했는가?
- [ ] 본문에서 `#` 대신 `##`부터 사용했는가?
- [ ] 코드 블록에 언어 이름을 지정했는가?
- [ ] 코드 예제에 비밀번호, API 키, 개인정보가 없는가?
- [ ] 한국어와 일본어 파일의 구조가 일치하는가?
- [ ] 이미지 대체 텍스트를 작성했는가?
- [ ] 참고자료 링크가 실제 내용을 뒷받침하는가?
- [ ] 목차 링크가 정상적으로 이동하는가?
- [ ] 라이트 모드와 다크 모드에서 확인했는가?
- [ ] 모바일 화면에서 표와 코드가 넘치지 않는가?
- [ ] `draft: false`로 변경하기 전에 내용을 최종 검토했는가?

최종 빌드는 다음 명령어로 확인한다.

```bash
hugo --minify
```

