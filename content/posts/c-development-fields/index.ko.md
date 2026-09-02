---
title: "C 언어 개발 분야 이해하기: 임베디드계와 업무계의 차이"
date: 2026-09-02
draft: false
description: "C 언어가 사용되는 임베디드계와 업무계를 기초부터 비교하고, 실행 환경·코드·메모리·동시성·테스트 방식의 차이를 예제로 설명합니다."
tags: ["C", "Embedded", "Business System", "Memory", "Real-Time"]
categories: ["C"]
showTableOfContents: true
---

C 언어를 공부하다 보면 같은 문법을 사용하면서도 개발 분야에 따라 코드의 모습과 중요하게 보는 기준이 크게 달라진다. 특히 일본의 개발 현장에서는 **임베디드계(組み込み系)**와 **업무계(業務系)**라는 표현을 자주 사용한다.

임베디드계는 전자제품이나 기계 내부의 컴퓨터를 제어하는 분야이고, 업무계는 회사의 주문·재고·회계·고객 관리 같은 업무를 처리하는 분야다. C 언어는 임베디드계에서 핵심 언어로 널리 사용되며, 업무계에서는 Java나 C#보다 비중이 작지만 기존 시스템, 고속 처리 모듈, 네이티브 라이브러리 등에서 사용된다.

{{< conclusion >}}
**핵심:** 임베디드계와 업무계의 차이는 문법이 아니라 **프로그램이 실행되는 환경과 실패했을 때의 영향**에서 시작한다. 임베디드 코드는 제한된 장치와 시간 제약을 직접 다루고, 업무계 코드는 데이터의 정확성·유지보수성·외부 시스템 연계를 중시한다.
{{< /conclusion >}}

## 먼저 알아둘 용어

### 임베디드계란 무엇인가

임베디드 시스템은 특정 기능을 수행하도록 제품이나 기계 안에 포함된 컴퓨터 시스템이다. 자동차의 엔진 제어 장치, 에어컨의 온도 제어기, 공장의 로봇, 프린터, 공유기, 스마트워치 등이 대표적인 예다.

범위가 매우 넓기 때문에 임베디드라고 해서 모두 작은 8비트 마이크로컨트롤러만 사용하는 것은 아니다.

- **Bare-metal:** 운영체제 없이 초기화 코드와 메인 루프가 하드웨어에서 직접 실행된다.
- **RTOS 기반:** FreeRTOS 같은 실시간 운영체제 위에서 여러 태스크를 실행한다.
- **Embedded Linux 기반:** Linux가 설치된 공유기, 카메라, 차량용 장치처럼 프로세스와 파일 시스템을 사용하는 장치다.

### 업무계란 무엇인가

업무계 시스템은 조직의 업무 절차와 데이터를 처리하는 소프트웨어다. 일본어의 `業務系システム`에서 온 표현이며, 영업 부서만을 위한 시스템이라는 뜻의 **영업계**와는 다르다.

대표적인 예는 다음과 같다.

- 판매·주문·재고 관리
- 회계·급여·인사 관리
- 은행 거래와 결제 처리
- 고객 관리와 사내 승인 시스템
- 배치 처리, 데이터 변환, 다른 시스템과의 연계

업무계의 주력 언어는 Java, C#, JavaScript, Python 등이지만 Unix/Linux에서 오래 운영된 C 프로그램, 고속 계산 라이브러리, 데이터베이스 드라이버, 다른 언어가 호출하는 네이티브 모듈도 존재한다.

### 시스템계와 제어계는 어디에 들어가는가

채용 공고에서는 분류가 완전히 통일되어 있지 않다. `システム系`, `制御系`, `組み込み・制御系`라는 표현도 함께 사용된다.

| 구분 | 주된 대상 | C 언어의 역할 |
| --- | --- | --- |
| 임베디드계 | 제품 안의 MCU·SoC | 장치 제어와 펌웨어의 주력 언어 |
| 제어계 | 공장 설비·로봇·자동차 | 센서 입력과 실시간 제어 |
| 시스템계 | OS·드라이버·컴파일러·미들웨어 | 하드웨어와 응용 프로그램 사이의 기반 구현 |
| 업무계 | 기업의 업무와 데이터 | 기존 프로그램, 고속 모듈, 서버 유틸리티 |

제어계는 임베디드계와 많이 겹치고, 시스템계는 임베디드와 서버 양쪽에 걸쳐 있다. 따라서 이름만 보고 판단하기보다 **대상 장치, 운영체제, 개발 언어, 담당 공정**을 함께 확인해야 한다.

## 한눈에 보는 임베디드계와 업무계

| 비교 항목 | 임베디드계 | 업무계 |
| --- | --- | --- |
| 실행 대상 | MCU, SoC, 전자제품, 기계 | PC, 서버, 클라우드 |
| 주요 입력 | 센서, 스위치, 인터럽트, 통신 프레임 | 화면 입력, 파일, DB, HTTP 요청 |
| 주요 출력 | 모터, LED, 디스플레이, 통신 장치 | 화면, 보고서, DB 갱신, API 응답 |
| 자원 | RAM·Flash·전력 제한이 큰 경우가 많음 | 상대적으로 넉넉하지만 처리량과 비용을 고려 |
| 시간 | 마감 시간을 지키는 실시간성이 중요할 수 있음 | 응답 시간과 처리량이 중요함 |
| 장애 영향 | 기기 오작동, 정지, 안전 문제 | 잘못된 데이터, 거래 실패, 업무 중단 |
| 변경 주기 | 하드웨어와 함께 검증하므로 느릴 수 있음 | 요구사항과 업무 제도에 따라 자주 변경 |
| 테스트 | 실기, 시뮬레이터, HIL, 오실로스코프 | 단위·통합·API·DB·인수 테스트 |
| 배포 | 펌웨어 기록, OTA 업데이트 | 서버 배포, 컨테이너, 패키지 교체 |

## 같은 C인데 실행 방식이 다른 이유

### Hosted 환경과 Freestanding 환경

C 표준은 실행 환경을 크게 **hosted environment**와 **freestanding environment**로 구분한다.

Hosted 환경은 일반적인 운영체제 위에서 실행되는 프로그램을 생각하면 된다. `main` 함수로 시작하고, 파일 입출력이나 동적 메모리 같은 표준 라이브러리를 폭넓게 사용할 수 있다. 업무계의 Linux 서버 프로그램은 보통 여기에 해당한다.

```c
#include <stdio.h>

int main(void) {
    printf("Hello, business system!\n");
    return 0;
}
```

Freestanding 환경은 운영체제가 없거나 표준 라이브러리가 완전하지 않은 환경이다. 임베디드 펌웨어가 대표적이다. 시작 지점이 반드시 일반적인 `main` 형태일 필요는 없으며, 사용할 수 있는 헤더와 기능도 구현 환경에 따라 달라진다.

```c
#include <stdint.h>

#define LED_REGISTER (*(volatile uint32_t *)0x40020014u)

void delay_ms(uint32_t milliseconds);

int main(void) {
    for (;;) {
        LED_REGISTER ^= (1u << 5);
        delay_ms(500u);  // 보드별로 구현해야 하는 함수
    }
}
```

이 코드는 개념을 보여주기 위한 예다. 실제 레지스터 주소와 비트 위치는 MCU의 데이터시트와 제조사 헤더 파일을 따라야 한다.

### 컴파일 결과도 다르다

PC에서 실행할 프로그램은 보통 현재 PC용 컴파일러로 빌드한다.

```bash
gcc -std=c17 -Wall -Wextra -Wpedantic app.c -o app
```

현재 ISO C 표준은 2024년에 발행된 C23이다. 다만 임베디드 컴파일러와 기존 프로젝트는 C11이나 C17을 사용하는 경우가 많으므로, 최신 버전을 무조건 선택하기보다 대상 툴체인이 지원하는 표준을 확인하고 `-std=` 옵션으로 명시하는 편이 안전하다.

다른 CPU가 장착된 임베디드 보드용 프로그램은 **크로스 컴파일러**를 사용한다.

```bash
arm-none-eabi-gcc -mcpu=cortex-m4 -mthumb \
  -ffreestanding -Os main.c startup.c -T linker.ld -o firmware.elf
```

임베디드 빌드에는 시작 코드, 링커 스크립트, 메모리 배치 정보가 추가된다. 빌드 결과도 운영체제가 실행하는 일반 실행 파일이 아니라 보드에 기록할 `.elf`, `.hex`, `.bin` 파일인 경우가 많다.

## 공통으로 필요한 C 언어 기초

분야가 달라도 변수, 함수, 포인터, 구조체 같은 문법의 의미는 동일하다.

### 자료형과 정수 범위

```c
#include <stdint.h>

int count = 10;
uint8_t sensor_value = 255u;
int16_t temperature_tenths = -35;  // -3.5°C
uint32_t elapsed_ms = 1000u;
```

`int`의 크기는 구현에 따라 달라질 수 있다. 통신 데이터나 하드웨어 레지스터처럼 정확한 비트 수가 중요할 때는 `uint8_t`, `int16_t`, `uint32_t`처럼 너비가 명확한 정수형을 사용한다.

임베디드에서는 부동소수점 연산 장치가 없거나 비용이 큰 MCU를 고려해 `23.7°C`를 `237`로 저장하는 **고정소수점 방식**을 사용하기도 한다. 업무계에서는 금액을 `double`로 처리할 때 생기는 반올림 문제를 피하려고 최소 화폐 단위의 정수 또는 별도의 십진수 처리 방식을 사용한다.

### 함수와 반환값

```c
#include <stdbool.h>

bool is_temperature_valid(int16_t value_tenths) {
    return value_tenths >= -400 && value_tenths <= 1250;
}
```

함수는 입력과 출력을 명확히 나누는 가장 기본적인 단위다. 임베디드에서는 함수의 실행 시간과 스택 사용량도 확인하고, 업무계에서는 오류 반환 규칙과 재사용성을 특히 중요하게 본다.

### 배열과 포인터

```c
#include <stddef.h>

int sum(const int *values, size_t length) {
    int total = 0;

    for (size_t i = 0; i < length; ++i) {
        total += values[i];
    }

    return total;
}
```

배열을 함수에 전달하면 배열 전체가 복사되는 것이 아니라 첫 요소를 가리키는 포인터가 전달된다. 따라서 포인터만으로는 길이를 알 수 없으므로 `length`를 함께 넘겨야 한다.

### 구조체와 열거형

```c
#include <stdint.h>

typedef enum {
    DEVICE_OK,
    DEVICE_WARNING,
    DEVICE_ERROR
} DeviceStatus;

typedef struct {
    uint32_t id;
    int16_t temperature_tenths;
    DeviceStatus status;
} DeviceRecord;
```

구조체는 관련 데이터를 하나의 의미 있는 단위로 묶는다. 임베디드에서는 센서 상태나 통신 프레임에, 업무계에서는 고객·주문·거래 레코드 표현에 사용한다.

## 코드에서 드러나는 가장 큰 차이

같은 “온도가 기준을 넘으면 경고한다”라는 요구사항을 두 분야에서 구현해 보자.

### 임베디드계 예제: 센서를 주기적으로 확인하기

```c
#include <stdbool.h>
#include <stdint.h>

#define WARNING_TEMPERATURE_TENTHS 800

static bool warning_output = false;

int16_t adc_read_temperature(void);
void gpio_set_warning(bool enabled);
void delay_ms(uint32_t milliseconds);

int main(void) {
    for (;;) {
        const int16_t temperature = adc_read_temperature();

        if (temperature >= WARNING_TEMPERATURE_TENTHS) {
            warning_output = true;
        } else if (temperature <= WARNING_TEMPERATURE_TENTHS - 20) {
            warning_output = false;
        }

        gpio_set_warning(warning_output);
        delay_ms(100u);
    }
}
```

이 코드는 100ms마다 센서를 읽고 80.0°C 이상이면 경고 출력을 켠다. 온도가 경계에서 조금씩 흔들릴 때 출력이 계속 켜졌다 꺼지는 현상을 막기 위해, 끄는 기준을 78.0°C로 낮춘 **히스테리시스**도 적용했다.

여기서 중요한 것은 다음과 같다.

- 센서와 GPIO라는 하드웨어 입출력이 있다.
- 프로그램이 끝나지 않고 무한 루프를 반복한다.
- 정해진 주기로 실행되어야 한다.
- 실수 대신 0.1°C 단위의 정수를 사용한다.
- 경계값 주변의 실제 센서 노이즈를 고려한다.

### 업무계 예제: 명령행으로 받은 온도 검사하기

```c
#include <errno.h>
#include <stdio.h>
#include <stdlib.h>

#define WARNING_TEMPERATURE 80.0

int main(int argc, char *argv[]) {
    if (argc != 2) {
        fprintf(stderr, "Usage: %s <temperature>\n", argv[0]);
        return EXIT_FAILURE;
    }

    char *end = NULL;
    errno = 0;
    const double temperature = strtod(argv[1], &end);

    if (errno != 0 || end == argv[1] || *end != '\0') {
        fprintf(stderr, "Invalid temperature: %s\n", argv[1]);
        return EXIT_FAILURE;
    }

    if (temperature >= WARNING_TEMPERATURE) {
        printf("WARNING,%.1f\n", temperature);
    } else {
        printf("NORMAL,%.1f\n", temperature);
    }

    return EXIT_SUCCESS;
}
```

업무계 예제는 명령행에서 받은 문자열을 숫자로 변환하고 결과를 출력한다. 실제 배치 프로그램이라면 이 자리에 파일이나 DB에서 읽은 레코드가 들어갈 수 있다. 이 코드에서 중요한 것은 다음과 같다.

- 사용자의 잘못된 입력을 검사한다.
- 성공과 실패를 종료 코드로 외부 프로그램에 알린다.
- 표준 입력·출력·오류 스트림을 사용한다.
- 다른 배치 작업이나 셸 스크립트와 연결할 수 있다.
- 프로그램은 한 건을 처리한 뒤 종료한다.

두 예제 모두 `if`문으로 온도를 비교하지만 주변 코드는 완전히 다르다. **임베디드 코드는 물리 세계의 상태와 시간에 연결되고, 업무계 코드는 데이터 형식과 다른 소프트웨어에 연결된다.**

## 임베디드 C에서 특히 중요한 요소

### `volatile`의 의미

```c
#include <stdint.h>

#define STATUS_REGISTER (*(volatile uint32_t *)0x40000000u)

uint32_t wait_until_ready(void) {
    while ((STATUS_REGISTER & 0x01u) == 0u) {
        // 하드웨어가 값을 바꿀 때까지 대기한다.
    }

    return STATUS_REGISTER;
}
```

`volatile`은 해당 값이 현재 코드 밖의 요인에 의해 바뀔 수 있으므로 접근을 임의로 없애거나 합치지 말라고 컴파일러에 알린다. 하드웨어 레지스터나 인터럽트와 공유하는 단순 플래그에 사용된다.

하지만 `volatile`은 다음을 보장하지 않는다.

- 여러 연산을 하나의 원자적 연산으로 만들지 않는다.
- 스레드나 코어 사이의 동기화를 완성하지 않는다.
- 경쟁 상태를 자동으로 방지하지 않는다.

동시 실행 주체 사이에서 데이터를 안전하게 공유하려면 원자적 연산, 임계 구역, 뮤텍스, 메시지 큐 등 실행 환경에 맞는 동기화 방법이 필요하다.

### 인터럽트 서비스 루틴

```c
#include <stdbool.h>

static volatile bool button_pressed = false;

void clear_button_interrupt_flag(void);
void disable_interrupts(void);
void enable_interrupts(void);
void handle_button_event(void);

void EXTI_IRQHandler(void) {
    clear_button_interrupt_flag();
    button_pressed = true;
}

int main(void) {
    for (;;) {
        if (button_pressed) {
            disable_interrupts();
            button_pressed = false;
            enable_interrupts();

            handle_button_event();
        }
    }
}
```

인터럽트 함수에서는 보통 플래그를 정리하고 필요한 상태만 기록한 뒤 빠르게 복귀한다. 오래 걸리는 계산, 블로킹 입출력, 큰 로그 출력은 메인 루프나 RTOS 태스크로 넘기는 편이 안전하다.

실제 MCU에서는 인터럽트 중첩, 원자적으로 읽고 쓸 수 있는 자료형의 크기, 메모리 배리어를 추가로 검토해야 한다.

### 메모리 맵과 링커

마이크로컨트롤러에는 보통 코드와 상수가 들어가는 Flash, 실행 중 데이터가 들어가는 RAM, 주변장치 레지스터 영역이 나뉘어 있다.

```text
Flash:  프로그램 코드, 읽기 전용 상수, 초기값
RAM:    전역 변수, static 변수, 힙, 스택
MMIO:   GPIO, UART, ADC 같은 주변장치 레지스터
```

링커 스크립트는 각 섹션을 어느 주소에 배치할지 결정한다. 메모리가 부족한 장치에서는 컴파일 성공만 확인하지 않고 map 파일을 통해 `.text`, `.data`, `.bss`, 힙, 스택의 크기도 확인한다.

### 동적 메모리를 조심하는 이유

```c
#include <stddef.h>
#include <stdint.h>
#include <stdlib.h>

typedef struct {
    uint16_t values[64];
    size_t length;
} SensorBuffer;

SensorBuffer *sensor_buffer_create(void) {
    SensorBuffer *buffer = malloc(sizeof(*buffer));

    if (buffer == NULL) {
        return NULL;  // 할당 실패를 호출자에게 전달한다.
    }

    buffer->length = 0u;
    return buffer;
}
```

`malloc` 자체가 항상 금지되는 것은 아니다. 그러나 장시간 실행되는 작은 장치에서는 메모리 단편화, 할당 시간의 변동, 할당 실패 처리 때문에 동적 할당을 제한하는 설계가 많다.

대안으로는 다음을 사용할 수 있다.

- 크기가 정해진 정적 배열
- 초기화 시 한 번만 할당
- 고정 크기 메모리 풀
- 객체의 소유권과 수명을 명확히 한 전용 할당기

### 상태 머신

임베디드 프로그램은 상태 머신으로 장치 동작을 표현하는 경우가 많다.

```c
#include <stdbool.h>
#include <stdint.h>

typedef enum {
    STATE_IDLE,
    STATE_HEATING,
    STATE_ERROR
} SystemState;

SystemState update_state(SystemState current,
                         int16_t temperature,
                         bool start_requested) {
    switch (current) {
        case STATE_IDLE:
            return start_requested ? STATE_HEATING : STATE_IDLE;

        case STATE_HEATING:
            return temperature >= 800 ? STATE_IDLE : STATE_HEATING;

        case STATE_ERROR:
        default:
            return STATE_ERROR;
    }
}
```

상태와 전이 조건을 명확히 하면 복잡한 `if`문이 흩어지는 것을 막고, 하드웨어 없이도 순수 함수 형태로 단위 테스트하기 쉬워진다.

## 업무계 C에서 특히 중요한 요소

### 입력 검증과 오류 처리

C는 예외가 없으므로 반환값과 출력 매개변수로 오류를 전달하는 방식이 일반적이다.

```c
#include <errno.h>
#include <limits.h>
#include <stdbool.h>
#include <stdlib.h>

bool parse_quantity(const char *text, int *result) {
    if (text == NULL || result == NULL) {
        return false;
    }

    char *end = NULL;
    errno = 0;
    const long value = strtol(text, &end, 10);

    if (errno != 0 || end == text || *end != '\0' ||
        value < 0 || value > INT_MAX) {
        return false;
    }

    *result = (int)value;
    return true;
}
```

`atoi`는 실패를 구분하기 어렵기 때문에 검증이 필요할 때는 `strtol` 계열이 적합하다. 포인터의 `NULL` 여부, 숫자의 범위, 문자열 끝까지 정상적으로 변환됐는지를 모두 확인한다.

### 문자열과 버퍼 크기

```c
#include <stdio.h>

int make_order_label(char *buffer,
                     size_t buffer_size,
                     unsigned int order_id) {
    const int written = snprintf(buffer, buffer_size,
                                 "ORDER-%08u", order_id);

    if (written < 0 || (size_t)written >= buffer_size) {
        return -1;
    }

    return 0;
}
```

C 문자열은 끝을 나타내는 널 문자 `\0`이 필요하다. 버퍼보다 긴 문자열을 기록하면 메모리 손상이 발생할 수 있으므로 크기를 함께 전달하고 잘림 여부를 확인해야 한다.

### 파일 처리와 자원 정리

```c
#include <stdio.h>

int count_records(const char *path, size_t *count) {
    FILE *file = fopen(path, "r");
    if (file == NULL) {
        return -1;
    }

    size_t records = 0;
    char line[256];

    while (fgets(line, sizeof(line), file) != NULL) {
        ++records;
    }

    const int read_failed = ferror(file);
    const int close_failed = fclose(file);

    if (read_failed || close_failed != 0) {
        return -1;
    }

    *count = records;
    return 0;
}
```

파일, 소켓, DB 연결, 동적 메모리는 사용이 끝나면 반드시 해제해야 한다. 함수 중간에 오류가 발생해도 정리 코드가 빠지지 않도록 하나의 종료 경로를 두거나 작은 함수로 책임을 나누는 방식이 유용하다.

### 데이터베이스와 트랜잭션

업무계 프로그램은 여러 데이터를 하나의 논리적 작업으로 갱신한다. 예를 들어 주문 저장과 재고 감소 중 하나만 성공하면 데이터가 불일치한다.

```c
if (db_begin(connection) != DB_OK) {
    return ORDER_ERROR;
}

if (insert_order(connection, &order) != DB_OK ||
    decrease_stock(connection, order.product_id, order.quantity) != DB_OK) {
    db_rollback(connection);
    return ORDER_ERROR;
}

if (db_commit(connection) != DB_OK) {
    db_rollback(connection);
    return ORDER_ERROR;
}
```

위 함수들은 설명을 위한 가상 API다. 실제로는 PostgreSQL의 `libpq`, SQLite C API 등 사용하는 DB 라이브러리의 규칙을 따라야 한다. 중요한 것은 관련 변경을 트랜잭션으로 묶고, 실패 시 롤백하며, 재시도했을 때 중복 처리가 생기지 않도록 설계하는 것이다.

## 메모리 관리 방식 비교

### 저장 영역과 수명

```c
#include <stdlib.h>

static int global_counter;          // 정적 저장 기간

void example(void) {
    int local_value = 10;           // 블록을 벗어나면 수명 종료
    int *dynamic_value = malloc(sizeof(*dynamic_value));

    if (dynamic_value != NULL) {
        *dynamic_value = 20;
        free(dynamic_value);        // 해제 후 접근하면 안 됨
        dynamic_value = NULL;
    }
}
```

| 문제 | 임베디드계에서의 영향 | 업무계에서의 영향 |
| --- | --- | --- |
| 메모리 누수 | 재부팅 전까지 회복되지 않아 장시간 운전 중 장애 | 서버 프로세스의 메모리가 계속 증가 |
| 버퍼 초과 | 레지스터나 제어 상태 손상 가능 | 보안 취약점, 프로세스 종료, 데이터 손상 |
| 해제 후 사용 | 예측하기 어려운 장치 오작동 | 충돌 또는 원격 공격 가능성 |
| 큰 스택 사용 | 작은 태스크 스택이 즉시 넘칠 수 있음 | 스레드 수가 많을 때 메모리 소비 증가 |

분야와 상관없이 메모리 오류 검사 도구와 정적 분석을 활용할 수 있다. PC에서 실행 가능한 모듈은 GCC나 Clang의 AddressSanitizer, UndefinedBehaviorSanitizer로 검사하고, 임베디드 전용 코드는 정적 분석과 타깃 디버거를 병행한다.

```bash
gcc -std=c17 -Wall -Wextra -Wpedantic \
  -fsanitize=address,undefined -g app.c -o app
```

## 동시성과 시간 처리 비교

### 임베디드의 실시간성

실시간 시스템에서 중요한 것은 단순히 평균 속도가 빠른 것이 아니라 **정해진 최악 시간 안에 반응하는 것**이다.

- 하드 실시간: 마감 시간 위반이 안전이나 시스템 실패로 이어질 수 있다.
- 소프트 실시간: 가끔 늦어질 수 있지만 품질이 떨어진다.

인터럽트 우선순위, 태스크 주기, 최악 실행 시간, 공유 자원 잠금 시간을 분석해야 한다. 높은 우선순위 태스크가 낮은 우선순위 태스크가 가진 잠금 때문에 기다리는 우선순위 역전도 고려 대상이다.

### 업무계의 동시성

업무계 서버는 여러 요청과 사용자를 동시에 처리한다. 이때는 다음 문제가 중요하다.

- 같은 재고를 두 사용자가 동시에 감소시키는 경쟁 상태
- 잠금 순서가 달라 생기는 교착 상태
- 중복 요청으로 같은 거래가 두 번 반영되는 문제
- 처리량을 높이려다 DB나 네트워크가 병목이 되는 문제

임베디드의 주기와 deadline이 업무계에서는 트랜잭션 격리, 타임아웃, 멱등성, 처리량이라는 설계 문제로 바뀌는 셈이다.

## 통신 코드에서 나타나는 차이

### 임베디드: 바이트 단위 프로토콜 해석

```c
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

bool parse_sensor_frame(const uint8_t *frame,
                        size_t length,
                        uint16_t *sensor_id,
                        int16_t *value) {
    if (frame == NULL || sensor_id == NULL || value == NULL || length != 6u) {
        return false;
    }

    if (frame[0] != 0xAAu || frame[5] != 0x55u) {
        return false;
    }

    *sensor_id = (uint16_t)((uint16_t)frame[1] << 8) | frame[2];
    *value = (int16_t)((uint16_t)((uint16_t)frame[3] << 8) | frame[4]);
    return true;
}
```

임베디드 통신에서는 바이트 순서, 비트 배치, 정렬, 체크섬, 프레임 길이를 정확히 다룬다. 외부 데이터를 구조체 포인터로 바로 형변환하면 정렬과 padding, endian 차이 때문에 이식성이 깨질 수 있으므로 바이트를 명시적으로 조합하는 편이 안전하다.

### 업무계: 레코드 단위 데이터 해석

```c
#include <stdio.h>

typedef struct {
    unsigned int product_id;
    unsigned int quantity;
} OrderItem;

int parse_order_line(const char *line, OrderItem *item) {
    if (line == NULL || item == NULL) {
        return -1;
    }

    if (sscanf(line, "%u,%u", &item->product_id, &item->quantity) != 2) {
        return -1;
    }

    return item->quantity == 0u ? -1 : 0;
}
```

실제 업무 데이터에서는 CSV의 따옴표와 줄바꿈, 문자 인코딩, 필드 수, 최대 길이를 처리해야 하므로 검증된 CSV/JSON 라이브러리를 사용하는 편이 좋다. 예제는 레코드 단위 처리 방식만 단순하게 보여준다.

## 설계와 코딩 규칙의 차이

### 임베디드계에서 자주 보는 기준

- 하드웨어 데이터시트와 회로도에 맞는가?
- 제한된 RAM과 Flash에 들어가는가?
- 최악 실행 시간과 응답 주기를 지키는가?
- 전원 차단과 통신 오류 후 안전한 상태로 돌아가는가?
- 정수 overflow, bit shift, 형변환이 의도대로 동작하는가?
- 컴파일러와 MCU가 바뀌어도 이식할 수 있는가?

자동차처럼 안전이 중요한 분야에서는 MISRA C, CERT C 같은 규칙 또는 프로젝트 전용 코딩 표준을 적용하기도 한다.

### 업무계에서 자주 보는 기준

- 요구사항과 업무 규칙을 정확히 반영하는가?
- 입력 오류와 외부 시스템 장애를 처리하는가?
- 트랜잭션과 데이터 정합성이 보장되는가?
- 로그만으로 장애 원인을 추적할 수 있는가?
- 장기간 변경하기 쉬운 구조인가?
- 개인정보와 인증 정보를 안전하게 다루는가?

공통점도 많다. 경고 없는 빌드, 명확한 인터페이스, 작은 함수, 경계값 검사, 자동 테스트는 어느 분야에서나 중요하다.

## 테스트 방법의 차이

### 공통 로직을 하드웨어에서 분리하기

앞에서 만든 상태 전이 함수처럼 계산 로직과 하드웨어 접근을 분리하면 PC에서도 테스트할 수 있다.

```c
#include <assert.h>

void test_heating_stops_at_limit(void) {
    const SystemState next = update_state(STATE_HEATING, 800, false);
    assert(next == STATE_IDLE);
}

int main(void) {
    test_heating_stops_at_limit();
    return 0;
}
```

### 임베디드 테스트

1. 순수 로직을 PC에서 단위 테스트한다.
2. 하드웨어 추상화 계층을 mock 또는 fake로 교체한다.
3. 개발 보드에서 드라이버와 주변장치를 통합 테스트한다.
4. 실제 신호를 넣는 HIL(Hardware-in-the-Loop) 테스트를 수행한다.
5. 경계 온도, 저전압, 통신 끊김, 센서 고장 같은 비정상 상태를 확인한다.

### 업무계 테스트

1. 파싱과 계산 함수를 단위 테스트한다.
2. 파일, DB, API 연계를 통합 테스트한다.
3. 실제 업무 시나리오로 인수 테스트한다.
4. 많은 요청과 대용량 데이터로 부하 테스트한다.
5. 권한 오류, 중복 요청, 네트워크 타임아웃, 롤백을 확인한다.

## 디버깅 도구의 차이

| 목적 | 임베디드계 | 업무계 |
| --- | --- | --- |
| 코드 중단·변수 확인 | JTAG/SWD 디버거, GDB | GDB, IDE 디버거 |
| 로그 | UART, RTT, 제한된 장치 로그 | 파일, 표준 출력, 중앙 로그 시스템 |
| 신호 확인 | 오실로스코프, 로직 애널라이저 | 네트워크 캡처, API 추적 |
| 메모리 오류 | 정적 분석, 타깃 검사, 호스트 sanitizer | sanitizer, Valgrind, 정적 분석 |
| 성능 | 주기 측정, GPIO 토글, trace | profiler, APM, DB 실행 계획 |

임베디드에서는 로그 한 줄이 타이밍에 영향을 줄 수도 있다. 업무계에서는 로그에 주문 번호나 요청 ID 같은 추적 정보를 남기되 개인정보와 비밀값은 기록하지 않아야 한다.

## 프로젝트 구조 예시

### 임베디드 프로젝트

```text
firmware/
├── application/     상태 머신과 제품 로직
├── drivers/         GPIO, UART, ADC 드라이버
├── hal/             하드웨어 추상화 계층
├── platform/        시작 코드와 MCU별 설정
├── tests/           호스트 단위 테스트
├── linker/          링커 스크립트
└── CMakeLists.txt
```

### 업무계 C 프로젝트

```text
order-service/
├── include/         공개 헤더
├── src/             업무 로직과 구현
├── adapters/        DB, 파일, 네트워크 연계
├── tests/           단위·통합 테스트
├── config/          실행 환경 설정
└── CMakeLists.txt
```

두 구조 모두 핵심 로직과 외부 의존성을 분리한다. 차이는 외부 의존성이 하드웨어인지, DB·파일·네트워크인지에 있다.

## 분야별 학습 순서

### 공통 기반

1. 변수, 조건문, 반복문, 함수
2. 배열, 문자열, 포인터
3. 구조체, 열거형, 비트 연산
4. 헤더 파일과 분할 컴파일
5. 메모리 수명과 오류 처리
6. Make 또는 CMake, 디버거, Git
7. 단위 테스트와 정적 분석

### 임베디드계로 가고 싶다면

1. 디지털 논리와 컴퓨터 구조를 익힌다.
2. MCU의 GPIO, timer, UART, ADC를 사용한다.
3. 데이터시트와 회로도를 읽는다.
4. 인터럽트, `volatile`, 메모리 맵을 이해한다.
5. 상태 머신과 비동기 이벤트 처리를 연습한다.
6. RTOS의 태스크, 큐, semaphore를 배운다.
7. JTAG/SWD와 로직 애널라이저로 디버깅한다.

처음에는 LED 점멸보다 한 단계 더 나아가 버튼 debounce, 온도 측정, UART 명령 처리, 센서 오류 복구까지 포함한 작은 장치를 만들어 보는 것이 좋다.

### 업무계로 가고 싶다면

1. 문자열과 파일을 안전하게 처리한다.
2. 프로세스, 스레드, 소켓 등 Linux 프로그래밍을 익힌다.
3. SQL과 트랜잭션을 이해한다.
4. HTTP, JSON, 문자 인코딩을 배운다.
5. 로그, 설정, 배치 처리, 오류 복구를 구현한다.
6. 보안 입력 검증과 권한 처리를 익힌다.
7. C 프로그램을 Java·Python 등과 연동해 본다.

다만 신규 업무 웹 시스템만을 목표로 한다면 C보다 Java/Spring 또는 C#/.NET을 먼저 배우는 편이 실무 기회가 많다. C는 운영체제에 가까운 처리, 기존 자산 유지보수, 성능이 중요한 모듈이라는 강점과 함께 가져가면 좋다.

## 어떤 분야가 자신에게 맞을까

| 이런 일이 재미있다면 | 더 가까운 분야 |
| --- | --- |
| 센서 값을 읽고 실제 장치를 움직이기 | 임베디드·제어계 |
| 비트, 메모리, CPU 동작을 깊이 이해하기 | 임베디드·시스템계 |
| 주문·재고·결제 같은 업무 흐름 설계하기 | 업무계 |
| DB와 API를 연결해 많은 사용자를 처리하기 | 업무계·웹 백엔드 |
| 성능 병목을 찾아 네이티브 모듈 최적화하기 | 시스템계·업무계 공통 |

어느 분야가 더 우월한 것은 아니다. 임베디드 경험은 하드웨어 이해, 자원 제약, 안정적인 상태 처리 능력을 길러 준다. 업무계 경험은 데이터 모델링, 트랜잭션, 사용자 요구사항과 대규모 운영을 배우게 한다. 장기적으로는 IoT 장치의 펌웨어와 이를 관리하는 백엔드를 모두 이해하는 **IoT 풀스택**도 강한 조합이 될 수 있다.

{{< conclusion >}}
**결론:** C 문법은 같아도 임베디드계에서는 하드웨어·메모리·실시간성·안전한 복구가, 업무계에서는 입력·데이터 정합성·외부 연계·유지보수성이 중심이 된다. 처음에는 공통 C 기초를 단단히 익힌 뒤, 임베디드는 MCU 프로젝트로, 업무계는 Linux·파일·DB 프로젝트로 실습하면 코드의 차이를 가장 빠르게 체감할 수 있다.
{{< /conclusion >}}

## 참고 자료

- [ISO/IEC 9899:2024 - Programming languages — C](https://www.iso.org/standard/82075.html)
- [GCC - Standards Supported by GCC](https://gcc.gnu.org/onlinedocs/gcc/Standards.html)
- [GCC - Options Controlling C Dialect](https://gcc.gnu.org/onlinedocs/gcc/C-Dialect-Options.html)
- [FreeRTOS Documentation](https://www.freertos.org/Documentation/RTOS_book.html)
- [SEI CERT C Coding Standard](https://wiki.sei.cmu.edu/confluence/display/c/SEI+CERT+C+Coding+Standard)
- [PostgreSQL - libpq C Library](https://www.postgresql.org/docs/current/libpq.html)
- [SQLite C/C++ Interface](https://www.sqlite.org/cintro.html)
