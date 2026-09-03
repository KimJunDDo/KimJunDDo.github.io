---
title: "C 언어 한 번에 배우기: 기초 문법부터 포인터와 정렬 알고리즘까지"
date: 2026-09-03
draft: false
description: "C 언어의 프로그램 구조, 자료형, 제어문, 함수, 배열, 포인터, 동적 메모리, 구조체, 파일 처리와 기본 알고리즘을 예제와 함께 정리합니다."
tags: ["C", "Programming Basics", "Pointer", "Data Structure", "Algorithm"]
categories: ["C"]
showTableOfContents: true
---

C 언어는 운영체제, 임베디드 펌웨어, 드라이버, 데이터베이스와 고성능 라이브러리의 기반으로 사용되는 언어다. 문법 자체는 비교적 작지만, 메모리와 자료형을 개발자가 직접 다루기 때문에 컴퓨터가 프로그램을 실행하는 원리를 깊이 이해할 수 있다.

이 글은 처음 C를 배우는 사람이 위에서 아래로 따라가며 공부할 수 있도록 구성했다. 마지막에는 선형 검색과 이진 검색, 버블·선택·삽입·병합·퀵 정렬 등 기본 알고리즘을 C 코드로 구현한다.

{{< conclusion >}}
**핵심:** C에서 가장 중요한 것은 문법을 외우는 것보다 **자료형, 메모리의 수명, 배열과 포인터의 관계, 함수의 입력과 출력**을 정확히 이해하는 것이다. 코드를 직접 컴파일하고 경고를 하나씩 해결하면서 학습하면 훨씬 빠르게 익힐 수 있다.
{{< /conclusion >}}

## 개발 환경과 첫 프로그램

### 컴파일 과정

C 소스 파일은 그대로 실행되지 않는다. 전처리, 컴파일, 어셈블, 링크 과정을 거쳐 실행 파일이 된다.

```text
main.c → 전처리 → 컴파일 → 어셈블 → 링크 → 실행 파일
```

GCC를 사용한다면 다음처럼 빌드할 수 있다.

```bash
gcc -std=c17 -Wall -Wextra -Wpedantic main.c -o main
./main
```

- `-std=c17`: C17 규격을 사용한다.
- `-Wall -Wextra -Wpedantic`: 실수를 발견하는 데 도움이 되는 경고를 켠다.
- `-o main`: 결과 실행 파일의 이름을 `main`으로 지정한다.

### Hello, World

```c
#include <stdio.h>

int main(void) {
    printf("Hello, C!\n");
    return 0;
}
```

`#include <stdio.h>`는 표준 입출력 함수의 선언을 가져온다. 프로그램은 `main`에서 시작한다. `printf`는 문자열을 출력하고, `\n`은 줄바꿈 문자다. `return 0`은 운영체제에 정상 종료를 알린다.

## 변수, 상수와 자료형

### 변수 선언과 초기화

```c
int age = 25;
double height = 175.5;
char grade = 'A';
```

변수는 값을 보관하는 이름이 붙은 메모리 공간이다. 선언할 때 자료형과 이름을 적고, 가능하면 동시에 초기화한다. 초기화하지 않은 지역 변수의 값을 읽으면 정의되지 않은 동작이 발생할 수 있다.

### 기본 자료형

| 자료형 | 용도 | 출력 형식 예시 |
| --- | --- | --- |
| `char` | 문자 또는 작은 정수 | `%c` |
| `int` | 일반 정수 | `%d` |
| `unsigned int` | 0 이상의 정수 | `%u` |
| `long long` | 큰 정수 | `%lld` |
| `float` | 단정밀도 실수 | `%f` |
| `double` | 배정밀도 실수 | `%f` |
| `bool` | 참과 거짓 | 정수 형태로 출력 |

자료형의 정확한 크기는 구현에 따라 다를 수 있다. 크기는 `sizeof`로 확인한다.

```c
#include <stdio.h>

int main(void) {
    printf("int: %zu bytes\n", sizeof(int));
    printf("double: %zu bytes\n", sizeof(double));
    return 0;
}
```

`sizeof`의 결과는 `size_t`이며 `%zu`로 출력한다. 비트 수가 정확해야 하는 통신이나 임베디드 코드에서는 `<stdint.h>`의 `int32_t`, `uint8_t` 등을 사용한다.

### 부호 있는 정수와 없는 정수

```c
int temperature = -10;
unsigned int count = 10u;
```

`unsigned`는 음수를 표현하지 못하는 대신 같은 크기에서 더 큰 양수를 표현한다. 다만 signed와 unsigned를 섞어 비교하면 예상하지 못한 변환이 일어날 수 있으므로 주의한다.

### 상수

```c
const double pi = 3.141592653589793;
#define MAX_USERS 100
```

`const` 객체는 초기화 후 코드에서 값을 바꾸지 않겠다는 의도를 나타내며 자료형이 있다. `#define`은 전처리 단계에서 텍스트를 치환한다. 단순 값에는 보통 `const`나 `enum`을 우선하고, 조건부 컴파일이나 매크로가 필요할 때 `#define`을 사용한다.

### 형변환

```c
int total = 7;
int count = 2;
double average = (double)total / count;
```

정수끼리 나누면 소수 부분이 버려진다. 하나를 `double`로 명시적 변환하면 실수 나눗셈이 수행되어 `3.5`가 된다. 큰 자료형을 작은 자료형으로 바꿀 때는 값이 잘릴 수 있다.

## 입력과 출력

### `printf`로 출력하기

```c
int age = 25;
double score = 92.75;

printf("age = %d\n", age);
printf("score = %.2f\n", score);
```

형식 지정자와 인수의 실제 자료형이 맞아야 한다. `%.2f`는 소수점 아래 두 자리까지 출력한다.

### `scanf`로 숫자 입력받기

```c
#include <stdio.h>

int main(void) {
    int number;

    printf("정수 입력: ");
    if (scanf("%d", &number) != 1) {
        fprintf(stderr, "올바른 정수가 아닙니다.\n");
        return 1;
    }

    printf("입력값: %d\n", number);
    return 0;
}
```

`scanf`는 값을 저장할 변수의 **주소**가 필요하므로 `&number`를 전달한다. 반환값은 성공적으로 읽은 항목 수이므로 반드시 확인한다.

문자열 입력은 공백과 버퍼 길이 문제 때문에 `fgets`를 사용하는 편이 안전하다.

```c
char name[50];

if (fgets(name, sizeof(name), stdin) == NULL) {
    return 1;
}
```

## 연산자

### 산술·비교·논리 연산자

```c
int a = 10;
int b = 3;

printf("%d\n", a + b);  // 13
printf("%d\n", a / b);  // 3
printf("%d\n", a % b);  // 1

bool in_range = a >= 0 && a <= 100;
bool different = a != b;
```

`&&`는 AND, `||`는 OR, `!`는 NOT이다. `&&`와 `||`는 결과가 이미 정해지면 오른쪽 식을 평가하지 않는 **단락 평가**를 한다.

```c
if (pointer != NULL && *pointer > 0) {
    /* pointer가 NULL이면 오른쪽은 실행되지 않는다. */
}
```

### 증가와 대입 연산자

```c
count++;
count += 5;
count *= 2;
```

`i++`는 현재 값을 사용한 뒤 증가하고, `++i`는 먼저 증가한 값을 사용한다. 한 문장 안에서 같은 변수를 여러 번 변경하는 복잡한 표현은 피한다.

### 비트 연산자

```c
unsigned int flags = 0u;

flags |= (1u << 2);    // 2번 비트 켜기
flags &= ~(1u << 2);   // 2번 비트 끄기
flags ^= (1u << 1);    // 1번 비트 뒤집기
bool set = (flags & (1u << 1)) != 0u;
```

`&`, `|`, `^`, `~`, `<<`, `>>`는 비트 단위로 동작한다. 장치 레지스터, 권한 플래그, 압축된 데이터 형식에서 자주 사용한다.

## 조건문과 반복문

### `if`, `else if`, `else`

```c
if (score >= 90) {
    printf("A\n");
} else if (score >= 80) {
    printf("B\n");
} else {
    printf("C\n");
}
```

조건이 참이면 해당 블록을 실행한다. `=`는 대입이고 `==`는 같은지 비교하는 연산자라는 차이를 기억한다.

### `switch`

```c
switch (menu) {
    case 1:
        printf("조회\n");
        break;
    case 2:
        printf("등록\n");
        break;
    default:
        printf("잘못된 메뉴\n");
        break;
}
```

`break`가 없으면 다음 `case`까지 계속 실행된다. 의도적인 fall-through가 아니라면 `break`를 적는다.

### `for`, `while`, `do while`

```c
for (int i = 0; i < 5; ++i) {
    printf("%d ", i);
}

int count = 3;
while (count > 0) {
    --count;
}

do {
    printf("최소 한 번 실행\n");
} while (false);
```

반복 횟수가 분명하면 `for`, 조건에 따라 계속 반복하면 `while`이 읽기 쉽다. `do while`은 조건 검사 전에 본문을 한 번 실행한다.

`break`는 반복을 끝내고, `continue`는 현재 반복의 나머지를 건너뛴다.

## 함수

### 선언, 정의와 호출

```c
int add(int left, int right);  // 선언

int main(void) {
    int result = add(10, 20);  // 호출
    return result == 30 ? 0 : 1;
}

int add(int left, int right) { // 정의
    return left + right;
}
```

함수 선언은 이름, 매개변수, 반환형을 컴파일러에 알려 준다. 함수는 한 가지 책임만 갖도록 작게 만들고, 이름으로 역할을 알 수 있게 한다.

### 값에 의한 전달

```c
void increase(int value) {
    value++;
}
```

C의 함수 인수는 값으로 복사된다. 위 함수에서 `value`를 바꿔도 호출한 쪽의 변수는 변하지 않는다. 호출자의 값을 바꾸려면 주소를 전달한다.

```c
void swap(int *left, int *right) {
    int temporary = *left;
    *left = *right;
    *right = temporary;
}
```

### 재귀 함수

```c
unsigned long long factorial(unsigned int n) {
    if (n <= 1u) {
        return 1u;
    }
    return n * factorial(n - 1u);
}
```

재귀는 함수가 자기 자신을 호출하는 방식이다. 반드시 종료 조건이 필요하며, 호출할 때마다 스택을 사용한다. 큰 입력에서는 반복문이 더 안전할 수 있고 팩토리얼 값 자체도 빠르게 overflow한다.

## 변수의 범위와 저장 기간

```c
static int file_counter = 0;  // 이 소스 파일 안에서만 사용

void count_call(void) {
    static int calls = 0;     // 호출이 끝나도 값 유지
    int local = 10;           // 블록 종료 시 수명 종료
    ++calls;
    ++file_counter;
}
```

- 지역 변수는 선언된 블록 안에서만 보인다.
- 전역 변수는 여러 함수에서 접근할 수 있지만 의존성이 커지므로 최소화한다.
- 함수 내부의 `static` 지역 변수는 프로그램 종료 때까지 값을 유지한다.
- 파일 범위 함수나 변수에 `static`을 붙이면 다른 소스 파일에 공개되지 않는다.

## 배열

### 1차원 배열

```c
int scores[5] = {90, 85, 70, 95, 88};
size_t length = sizeof(scores) / sizeof(scores[0]);

for (size_t i = 0; i < length; ++i) {
    printf("%d\n", scores[i]);
}
```

배열 인덱스는 0부터 시작한다. 유효한 범위를 벗어나 접근하면 정의되지 않은 동작이다. `sizeof`를 이용한 길이 계산은 실제 배열이 존재하는 범위에서만 가능하며, 함수 매개변수로 전달된 포인터에는 사용할 수 없다.

### 2차원 배열

```c
int matrix[2][3] = {
    {1, 2, 3},
    {4, 5, 6}
};

for (size_t row = 0; row < 2; ++row) {
    for (size_t column = 0; column < 3; ++column) {
        printf("%d ", matrix[row][column]);
    }
    printf("\n");
}
```

C의 2차원 배열은 행 우선으로 연속 배치된다. 함수에 전달할 때는 뒤쪽 차원의 크기를 알려야 컴파일러가 주소를 계산할 수 있다.

```c
void print_matrix(size_t rows, int matrix[][3]);
```

## 문자열

C에는 별도의 문자열 자료형이 없다. **널 문자 `\0`로 끝나는 `char` 배열**을 문자열로 사용한다.

```c
char name[] = "Kim";  // {'K', 'i', 'm', '\0'}
```

### 주요 문자열 함수

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    char destination[20] = "Hello";
    const char *source = " C";

    size_t length = strlen(destination);
    int same = strcmp(destination, "Hello") == 0;

    if (strlen(destination) + strlen(source) + 1 <= sizeof(destination)) {
        strcat(destination, source);
    }

    printf("%s, %zu, %d\n", destination, length, same);
    return 0;
}
```

`strlen`은 널 문자를 제외한 길이, `strcmp`는 사전식 비교 결과를 반환한다. 복사와 연결 함수는 목적지 버퍼 크기를 자동으로 알지 못하므로 overflow를 막아야 한다. 출력 문자열을 조합할 때는 `snprintf`도 유용하다.

```c
char label[32];
int written = snprintf(label, sizeof(label), "USER-%04d", 25);

if (written < 0 || (size_t)written >= sizeof(label)) {
    /* 인코딩 오류 또는 잘림 처리 */
}
```

## 포인터

### 주소와 역참조

```c
int number = 10;
int *pointer = &number;

printf("value: %d\n", *pointer);
*pointer = 20;
```

`&number`는 변수의 주소이고, `int *pointer`는 `int`를 가리키는 포인터다. `*pointer`는 가리키는 위치의 값에 접근하는 역참조다.

포인터를 역참조하기 전에는 유효한 객체를 가리키는지 확인해야 한다.

```c
if (pointer != NULL) {
    printf("%d\n", *pointer);
}
```

### 배열과 포인터의 관계

```c
int values[] = {10, 20, 30};
int *p = values;

printf("%d\n", p[1]);       // 20
printf("%d\n", *(p + 1));   // 20
```

대부분의 식에서 배열 이름은 첫 요소를 가리키는 포인터로 변환된다. 그러나 배열과 포인터가 완전히 같은 것은 아니다. 배열은 전체 저장 공간을 소유하고 `sizeof(values)`는 배열 전체 크기지만, `sizeof(p)`는 포인터 자체의 크기다.

### `const`와 포인터

```c
const int *read_only_value;       // 가리키는 값을 수정하지 않음
int *const fixed_pointer = &number; // 다른 주소를 가리킬 수 없음
const int *const both_fixed = &number;
```

오른쪽에서 왼쪽으로 읽으면 이해하기 쉽다. 함수가 데이터를 읽기만 한다면 `const` 포인터를 받아 수정하지 않는다는 계약을 표현한다.

### 이중 포인터

```c
void allocate_number(int **output) {
    *output = malloc(sizeof(**output));
    if (*output != NULL) {
        **output = 100;
    }
}
```

이중 포인터는 포인터의 주소다. 함수가 호출자의 포인터 자체를 변경해야 할 때 사용한다. 연결 리스트, 동적 2차원 배열, 출력 매개변수에서 자주 등장한다.

## 동적 메모리

```c
#include <stdio.h>
#include <stdlib.h>

int main(void) {
    size_t count = 5;
    int *numbers = calloc(count, sizeof(*numbers));

    if (numbers == NULL) {
        fprintf(stderr, "메모리 할당 실패\n");
        return 1;
    }

    for (size_t i = 0; i < count; ++i) {
        numbers[i] = (int)(i * 10);
    }

    free(numbers);
    numbers = NULL;
    return 0;
}
```

- `malloc`: 지정한 바이트를 할당하며 초기값은 정해지지 않는다.
- `calloc`: 개수와 요소 크기를 받아 할당한 바이트를 0으로 채운다.
- `realloc`: 기존 영역의 크기를 바꾼다.
- `free`: 할당한 메모리를 반환한다.

`realloc` 결과를 기존 포인터에 바로 대입하면 실패했을 때 기존 주소를 잃을 수 있다.

```c
int *temporary = realloc(numbers, new_count * sizeof(*numbers));
if (temporary != NULL) {
    numbers = temporary;
}
```

대표적인 오류는 메모리 누수, 이중 해제, 해제 후 사용, 범위를 넘는 접근이다. 할당한 주체와 해제할 주체, 객체의 수명을 명확히 정한다.

## 구조체, 열거형, 공용체와 `typedef`

### 구조체

```c
typedef struct {
    int id;
    char name[50];
    double score;
} Student;

Student student = {
    .id = 1,
    .name = "Junseok",
    .score = 95.5
};

printf("%s %.1f\n", student.name, student.score);
```

구조체 포인터로 멤버에 접근할 때는 `->`를 사용한다.

```c
void print_student(const Student *student) {
    if (student != NULL) {
        printf("%d %s\n", student->id, student->name);
    }
}
```

### 열거형

```c
typedef enum {
    STATUS_IDLE,
    STATUS_RUNNING,
    STATUS_ERROR
} Status;
```

`enum`은 서로 관련된 정수 상수에 이름을 붙여 상태나 선택지를 분명하게 표현한다.

### 공용체

```c
typedef union {
    int integer;
    float real;
    unsigned char bytes[4];
} Value;
```

`union`의 멤버들은 같은 메모리 공간을 공유한다. 한 번에 하나의 표현을 보관할 때 메모리를 절약할 수 있지만, 현재 어떤 멤버가 유효한지 별도의 태그로 관리해야 한다.

## 전처리기와 헤더 파일

### 매크로

```c
#define SQUARE(x) ((x) * (x))
```

매크로 인수와 전체 식에 괄호를 넣어 연산자 우선순위 문제를 줄인다. 하지만 `SQUARE(i++)`처럼 부작용이 있는 식을 전달하면 인수가 두 번 평가된다. 가능하면 `static inline` 함수를 사용한다.

```c
static inline int square(int value) {
    return value * value;
}
```

### 헤더와 구현 분리

```c
/* calculator.h */
#ifndef CALCULATOR_H
#define CALCULATOR_H

int add(int left, int right);

#endif
```

```c
/* calculator.c */
#include "calculator.h"

int add(int left, int right) {
    return left + right;
}
```

헤더에는 외부에 공개할 선언을, `.c` 파일에는 구현을 둔다. include guard는 같은 헤더가 여러 번 포함되어 선언이 중복되는 것을 막는다.

## 파일 입출력

```c
#include <stdio.h>

int main(void) {
    FILE *file = fopen("scores.txt", "w");
    if (file == NULL) {
        perror("fopen");
        return 1;
    }

    if (fprintf(file, "%s,%d\n", "Kim", 95) < 0) {
        fclose(file);
        return 1;
    }

    if (fclose(file) != 0) {
        perror("fclose");
        return 1;
    }

    return 0;
}
```

| 모드 | 의미 |
| --- | --- |
| `r` | 읽기 |
| `w` | 새로 쓰기, 기존 내용 제거 |
| `a` | 파일 끝에 추가 |
| `rb`, `wb` | 바이너리 읽기·쓰기 |

텍스트를 한 줄씩 읽을 때는 `fgets`, 바이너리 블록은 `fread`와 `fwrite`를 사용한다. 모든 입출력 결과와 `fclose` 결과를 확인한다.

## 오류 처리와 안전한 C 코드

### 반환값과 `errno`

```c
#include <errno.h>
#include <limits.h>
#include <stdlib.h>

int parse_integer(const char *text, int *result) {
    if (text == NULL || result == NULL) {
        return 0;
    }

    errno = 0;
    char *end = NULL;
    long value = strtol(text, &end, 10);

    if (errno != 0 || end == text || *end != '\0' ||
        value < INT_MIN || value > INT_MAX) {
        return 0;
    }

    *result = (int)value;
    return 1;
}
```

`atoi`는 오류를 구분하기 어렵다. 실제 입력 검증에는 `strtol`처럼 끝 위치와 범위 오류를 확인할 수 있는 함수를 사용한다.

### 정의되지 않은 동작

다음 코드는 컴파일되더라도 결과가 보장되지 않는다.

```c
int array[3] = {1, 2, 3};
printf("%d\n", array[5]);       // 배열 범위 초과

int *pointer = NULL;
printf("%d\n", *pointer);      // NULL 역참조

int maximum = INT_MAX;
maximum += 1;                    // signed 정수 overflow
```

정의되지 않은 동작은 단순히 에러가 나는 것이 아니라, 컴파일러가 그런 상황이 없다고 가정하고 코드를 최적화할 수 있다는 뜻이다. 경계 검사와 컴파일러 경고, 정적 분석, sanitizer를 함께 사용한다.

```bash
gcc -std=c17 -Wall -Wextra -Wpedantic \
  -fsanitize=address,undefined -g main.c -o main
```

## 기본 자료구조

### 연결 리스트

```c
typedef struct Node {
    int value;
    struct Node *next;
} Node;

void print_list(const Node *head) {
    for (const Node *current = head;
         current != NULL;
         current = current->next) {
        printf("%d ", current->value);
    }
}
```

연결 리스트는 각 노드가 다음 노드의 주소를 가진다. 중간 삽입과 삭제는 위치를 이미 알고 있다면 빠르지만, 특정 위치를 찾는 데는 처음부터 순회해야 한다.

### 배열 기반 스택

```c
#define STACK_CAPACITY 100

typedef struct {
    int data[STACK_CAPACITY];
    size_t size;
} Stack;

bool stack_push(Stack *stack, int value) {
    if (stack == NULL || stack->size == STACK_CAPACITY) {
        return false;
    }
    stack->data[stack->size++] = value;
    return true;
}

bool stack_pop(Stack *stack, int *value) {
    if (stack == NULL || value == NULL || stack->size == 0u) {
        return false;
    }
    *value = stack->data[--stack->size];
    return true;
}
```

스택은 나중에 넣은 값이 먼저 나오는 LIFO 구조다. 함수 호출, 괄호 검사, 되돌리기 기능, 깊이 우선 탐색에 활용된다.

## 알고리즘과 시간 복잡도

알고리즘은 문제를 해결하는 절차다. 입력 크기 `n`이 커질 때 실행 횟수나 메모리 사용량이 어떻게 증가하는지를 Big-O 표기법으로 표현한다.

| 복잡도 | 의미 | 예시 |
| --- | --- | --- |
| `O(1)` | 입력 크기와 무관한 일정한 작업 | 배열 인덱스 접근 |
| `O(log n)` | 단계마다 탐색 범위가 줄어듦 | 이진 검색 |
| `O(n)` | 모든 원소를 한 번 확인 | 선형 검색 |
| `O(n log n)` | 효율적인 비교 정렬 | 병합 정렬, 평균 퀵 정렬 |
| `O(n²)` | 이중 반복으로 원소 쌍 비교 | 버블·선택·삽입 정렬의 최악 시간 |

작은 입력에서는 단순한 알고리즘이 더 실용적일 수 있다. Big-O뿐 아니라 메모리 사용량, 입력 특성, 안정 정렬 여부도 함께 본다.

## 검색 알고리즘

### 선형 검색

```c
#include <stddef.h>

int linear_search(const int values[], size_t length, int target) {
    for (size_t i = 0; i < length; ++i) {
        if (values[i] == target) {
            return (int)i;
        }
    }
    return -1;
}
```

처음부터 하나씩 확인하며 정렬되지 않은 배열에도 사용할 수 있다. 시간 복잡도는 `O(n)`이다.

### 이진 검색

```c
int binary_search(const int values[], size_t length, int target) {
    size_t left = 0;
    size_t right = length;

    while (left < right) {
        size_t middle = left + (right - left) / 2;

        if (values[middle] == target) {
            return (int)middle;
        }
        if (values[middle] < target) {
            left = middle + 1;
        } else {
            right = middle;
        }
    }
    return -1;
}
```

이진 검색은 **오름차순으로 정렬된 배열**에서만 사용할 수 있다. 탐색 범위를 절반씩 줄이므로 시간 복잡도는 `O(log n)`이다. 구간을 `[left, right)`로 두면 빈 구간과 경계 처리가 명확해진다.

## 기본 정렬 알고리즘

### 버블 정렬

```c
void bubble_sort(int values[], size_t length) {
    for (size_t end = length; end > 1; --end) {
        bool swapped = false;

        for (size_t i = 1; i < end; ++i) {
            if (values[i - 1] > values[i]) {
                int temporary = values[i - 1];
                values[i - 1] = values[i];
                values[i] = temporary;
                swapped = true;
            }
        }

        if (!swapped) {
            break;
        }
    }
}
```

인접한 두 원소를 비교해 큰 값을 뒤로 보낸다. 구현은 쉽고 안정 정렬이지만 평균과 최악 시간은 `O(n²)`이다. 교환이 한 번도 없으면 이미 정렬된 상태이므로 중단한다.

### 선택 정렬

```c
void selection_sort(int values[], size_t length) {
    for (size_t i = 0; i < length; ++i) {
        size_t minimum = i;

        for (size_t j = i + 1; j < length; ++j) {
            if (values[j] < values[minimum]) {
                minimum = j;
            }
        }

        if (minimum != i) {
            int temporary = values[i];
            values[i] = values[minimum];
            values[minimum] = temporary;
        }
    }
}
```

정렬되지 않은 구간에서 최솟값을 찾아 앞에 놓는다. 비교 횟수는 항상 `O(n²)`이지만 교환 횟수는 적다. 일반적인 구현은 안정 정렬이 아니다.

### 삽입 정렬

```c
void insertion_sort(int values[], size_t length) {
    for (size_t i = 1; i < length; ++i) {
        int key = values[i];
        size_t position = i;

        while (position > 0 && values[position - 1] > key) {
            values[position] = values[position - 1];
            --position;
        }
        values[position] = key;
    }
}
```

현재 원소를 앞쪽의 정렬된 구간에 알맞게 삽입한다. 최악 시간은 `O(n²)`이지만 거의 정렬된 작은 배열에서는 빠르고 안정 정렬이다.

### 병합 정렬

```c
static void merge(int values[], int temporary[],
                  size_t left, size_t middle, size_t right) {
    size_t i = left;
    size_t j = middle;
    size_t k = left;

    while (i < middle && j < right) {
        temporary[k++] = values[i] <= values[j]
            ? values[i++] : values[j++];
    }
    while (i < middle) temporary[k++] = values[i++];
    while (j < right) temporary[k++] = values[j++];

    for (size_t index = left; index < right; ++index) {
        values[index] = temporary[index];
    }
}

static void merge_sort_range(int values[], int temporary[],
                             size_t left, size_t right) {
    if (right - left < 2) return;

    size_t middle = left + (right - left) / 2;
    merge_sort_range(values, temporary, left, middle);
    merge_sort_range(values, temporary, middle, right);
    merge(values, temporary, left, middle, right);
}

void merge_sort(int values[], size_t length) {
    int *temporary = malloc(length * sizeof(*temporary));
    if (temporary == NULL && length != 0u) return;

    merge_sort_range(values, temporary, 0, length);
    free(temporary);
}
```

배열을 절반씩 나눈 뒤 정렬된 두 구간을 합친다. 시간 복잡도는 항상 `O(n log n)`이고 안정 정렬이지만, 예제는 `O(n)`의 추가 메모리를 사용한다. 실제 코드에서는 할당 실패를 호출자에게 반환하도록 인터페이스를 설계하는 편이 좋다.

### 퀵 정렬

```c
static void quick_sort_range(int values[], long left, long right) {
    if (left >= right) return;

    int pivot = values[left + (right - left) / 2];
    long i = left;
    long j = right;

    while (i <= j) {
        while (values[i] < pivot) ++i;
        while (values[j] > pivot) --j;

        if (i <= j) {
            int temporary = values[i];
            values[i] = values[j];
            values[j] = temporary;
            ++i;
            --j;
        }
    }

    if (left < j) quick_sort_range(values, left, j);
    if (i < right) quick_sort_range(values, i, right);
}

void quick_sort(int values[], size_t length) {
    if (length > 1u) {
        quick_sort_range(values, 0, (long)length - 1);
    }
}
```

pivot을 기준으로 작은 값과 큰 값을 나눈 뒤 각 구간을 재귀적으로 정렬한다. 평균은 `O(n log n)`, 나쁜 pivot이 반복되면 최악은 `O(n²)`이며 일반적으로 안정 정렬이 아니다. 실제 표준 라이브러리에는 범용 정렬 함수 `qsort`가 있다.

```c
int compare_int(const void *left, const void *right) {
    int a = *(const int *)left;
    int b = *(const int *)right;
    return (a > b) - (a < b);
}

qsort(values, length, sizeof(values[0]), compare_int);
```

뺄셈으로 비교 결과를 반환하면 정수 overflow가 날 수 있으므로 관계 연산을 사용했다.

### 정렬 알고리즘 비교

| 알고리즘 | 평균 시간 | 최악 시간 | 추가 공간 | 안정 정렬 |
| --- | --- | --- | --- | --- |
| 버블 정렬 | `O(n²)` | `O(n²)` | `O(1)` | 예 |
| 선택 정렬 | `O(n²)` | `O(n²)` | `O(1)` | 아니요 |
| 삽입 정렬 | `O(n²)` | `O(n²)` | `O(1)` | 예 |
| 병합 정렬 | `O(n log n)` | `O(n log n)` | `O(n)` | 예 |
| 퀵 정렬 | `O(n log n)` | `O(n²)` | 재귀 스택 | 아니요 |

## 추가로 알아둘 기본 알고리즘

### 최대공약수: 유클리드 호제법

```c
unsigned int gcd(unsigned int a, unsigned int b) {
    while (b != 0u) {
        unsigned int remainder = a % b;
        a = b;
        b = remainder;
    }
    return a;
}
```

`gcd(a, b) = gcd(b, a % b)`라는 성질을 반복해서 사용한다. 시간 복잡도는 대략 `O(log min(a, b))`다.

### 소수 판별

```c
bool is_prime(unsigned int number) {
    if (number < 2u) return false;
    if (number % 2u == 0u) return number == 2u;

    for (unsigned int divisor = 3u;
         divisor <= number / divisor;
         divisor += 2u) {
        if (number % divisor == 0u) return false;
    }
    return true;
}
```

약수는 제곱근까지만 확인하면 된다. `divisor * divisor <= number` 대신 나눗셈을 사용해 곱셈 overflow 가능성을 피했다.

## 학습 순서와 연습 문제

1. 입출력, 조건문, 반복문으로 숫자 맞히기 프로그램을 만든다.
2. 함수와 배열로 학생 점수의 합계·평균·최댓값을 구한다.
3. 문자열 함수 없이 `strlen`, 문자열 뒤집기를 직접 구현한다.
4. 포인터로 `swap`과 배열 순회 함수를 작성한다.
5. 구조체 배열로 학생 관리 프로그램을 만든다.
6. 데이터를 파일에 저장하고 다시 읽는다.
7. 연결 리스트와 스택을 구현한다.
8. 각 정렬 알고리즘을 실행하고 비교 횟수를 측정한다.
9. 정렬된 배열에서 선형 검색과 이진 검색의 실행 횟수를 비교한다.
10. AddressSanitizer를 켜고 의도적으로 만든 메모리 오류를 찾아본다.

처음부터 모든 코드를 외울 필요는 없다. 입력과 출력, 배열의 길이, 포인터의 유효성, 메모리의 소유권을 종이에 그려 보면서 한 줄씩 추적하면 실력이 빠르게 늘어난다.

{{< conclusion >}}
**결론:** C 학습의 중심은 제어문 자체보다 자료형과 메모리다. 기본 문법을 익힌 뒤 배열·포인터·구조체·동적 메모리를 연결해서 이해하고, 검색과 정렬 알고리즘을 직접 구현하면 문법이 실제 문제 해결에 어떻게 쓰이는지 한 번에 정리할 수 있다.
{{< /conclusion >}}

## 참고 자료

- [ISO/IEC 9899:2024 - Programming languages — C](https://www.iso.org/standard/82075.html)
- [GCC - C Dialect Options](https://gcc.gnu.org/onlinedocs/gcc/C-Dialect-Options.html)
- [GCC - Warning Options](https://gcc.gnu.org/onlinedocs/gcc/Warning-Options.html)
- [GNU C Library Manual](https://sourceware.org/glibc/manual/latest/html_mono/libc.html)
- [SEI CERT C Coding Standard](https://wiki.sei.cmu.edu/confluence/display/c/SEI+CERT+C+Coding+Standard)
