---
title: "C言語の開発分野を理解する：組み込み系と業務系の違い"
date: 2026-09-02
draft: false
description: "C言語が使われる組み込み系と業務系を基礎から比較し、実行環境・コード・メモリ・並行処理・テスト方法の違いを例で解説します。"
tags: ["C", "Embedded", "Business System", "Memory", "Real-Time"]
categories: ["C"]
showTableOfContents: true
---

C言語を勉強していると、同じ文法を使っていても、開発分野によってコードの書き方や重視される基準が大きく異なることに気づく。特に日本の開発現場では、**組み込み系**と**業務系**という表現がよく使われる。

組み込み系は電子製品や機械の内部にあるコンピュータを制御する分野であり、業務系は企業の受注・在庫・会計・顧客管理などの業務を処理する分野である。C言語は組み込み系では主要言語として広く使われ、業務系ではJavaやC#より比率は低いものの、既存システム、高速処理モジュール、ネイティブライブラリなどで使われている。

{{< conclusion >}}
**要点:** 組み込み系と業務系の違いは、文法ではなく、**プログラムが動く環境と、失敗した場合に生じる影響**から始まる。組み込みコードは制限されたデバイスと時間制約を直接扱い、業務系コードはデータの正確性・保守性・外部システムとの連携を重視する。
{{< /conclusion >}}

## 最初に知っておきたい用語

### 組み込み系とは

組み込みシステムとは、特定の機能を実行するために製品や機械の中へ組み込まれたコンピュータシステムである。自動車のエンジン制御装置、エアコンの温度制御装置、工場のロボット、プリンター、ルーター、スマートウォッチなどが代表例である。

対象範囲は非常に広いため、組み込みといっても、小型の8ビットマイコンだけを使うわけではない。

- **ベアメタル:** OSを使わず、初期化コードとメインループがハードウェア上で直接動作する。
- **RTOSベース:** FreeRTOSのようなリアルタイムOS上で複数のタスクを動かす。
- **組み込みLinuxベース:** Linuxを搭載したルーター、カメラ、車載装置のように、プロセスやファイルシステムを使用する。

### 業務系とは

業務系システムとは、組織の業務手順とデータを処理するソフトウェアである。「営業部門だけで使うシステム」という意味ではなく、企業活動を支える幅広いシステムを指す。

代表例は次のとおりである。

- 販売・受注・在庫管理
- 会計・給与・人事管理
- 銀行取引や決済処理
- 顧客管理や社内承認システム
- バッチ処理、データ変換、他システムとの連携

業務系の主要言語はJava、C#、JavaScript、Pythonなどだが、Unix/Linux上で長期間稼働してきたCプログラム、高速計算ライブラリ、データベースドライバ、他言語から呼び出すネイティブモジュールも存在する。

### システム系と制御系はどこに含まれるか

求人情報で使われる分類は完全には統一されていない。`システム系`、`制御系`、`組み込み・制御系`といった表現も使われる。

| 分類 | 主な対象 | C言語の役割 |
| --- | --- | --- |
| 組み込み系 | 製品内のMCU・SoC | デバイス制御とファームウェアの主要言語 |
| 制御系 | 工場設備・ロボット・自動車 | センサー入力とリアルタイム制御 |
| システム系 | OS・ドライバ・コンパイラ・ミドルウェア | ハードウェアとアプリケーションの間にある基盤の実装 |
| 業務系 | 企業の業務とデータ | 既存プログラム、高速モジュール、サーバーユーティリティ |

制御系は組み込み系と大きく重なり、システム系は組み込みとサーバーの両方にまたがる。そのため、名称だけで判断せず、**対象デバイス、OS、開発言語、担当工程**を合わせて確認する必要がある。

## 組み込み系と業務系の比較

| 比較項目 | 組み込み系 | 業務系 |
| --- | --- | --- |
| 実行対象 | MCU、SoC、電子製品、機械 | PC、サーバー、クラウド |
| 主な入力 | センサー、スイッチ、割り込み、通信フレーム | 画面入力、ファイル、DB、HTTPリクエスト |
| 主な出力 | モーター、LED、ディスプレイ、通信デバイス | 画面、帳票、DB更新、APIレスポンス |
| リソース | RAM・Flash・電力の制限が厳しい場合が多い | 比較的余裕はあるが、処理量とコストを考慮する |
| 時間 | 締め切りを守るリアルタイム性が重要になる場合がある | 応答時間とスループットが重要 |
| 障害の影響 | 機器の誤作動、停止、安全上の問題 | 不正なデータ、取引失敗、業務停止 |
| 変更周期 | ハードウェアと合わせて検証するため遅い場合がある | 要件や業務制度に応じて頻繁に変更される |
| テスト | 実機、シミュレータ、HIL、オシロスコープ | 単体・結合・API・DB・受け入れテスト |
| 配布 | ファームウェア書き込み、OTA更新 | サーバー配布、コンテナ、パッケージ交換 |

## 同じCでも実行方法が異なる理由

### Hosted環境とFreestanding環境

C規格では、実行環境を大きく**hosted environment**と**freestanding environment**に分けている。

Hosted環境は、一般的なOS上で動くプログラムを考えると分かりやすい。`main`関数から開始し、ファイル入出力や動的メモリなどの標準ライブラリを幅広く利用できる。業務系のLinuxサーバープログラムは通常こちらに該当する。

```c
#include <stdio.h>

int main(void) {
    printf("Hello, business system!\n");
    return 0;
}
```

Freestanding環境は、OSが存在しない、または標準ライブラリが完全ではない環境である。組み込みファームウェアが代表例だ。開始点は必ずしも一般的な`main`の形式である必要はなく、利用できるヘッダーや機能も実装環境によって異なる。

```c
#include <stdint.h>

#define LED_REGISTER (*(volatile uint32_t *)0x40020014u)

void delay_ms(uint32_t milliseconds);

int main(void) {
    for (;;) {
        LED_REGISTER ^= (1u << 5);
        delay_ms(500u);  // ボードごとに実装が必要な関数
    }
}
```

このコードは概念を示す例である。実際のレジスタアドレスとビット位置は、MCUのデータシートとメーカー提供のヘッダーファイルに従う必要がある。

### コンパイル結果も異なる

PC上で実行するプログラムは、通常、現在のPC向けコンパイラでビルドする。

```bash
gcc -std=c17 -Wall -Wextra -Wpedantic app.c -o app
```

現在のISO C規格は、2024年に発行されたC23である。ただし、組み込みコンパイラや既存プロジェクトではC11やC17が使われている場合も多い。最新版を無条件に選ぶのではなく、対象ツールチェーンが対応する規格を確認し、`-std=`オプションで明示するほうが安全である。

異なるCPUを搭載した組み込みボード向けのプログラムでは、**クロスコンパイラ**を使用する。

```bash
arm-none-eabi-gcc -mcpu=cortex-m4 -mthumb \
  -ffreestanding -Os main.c startup.c -T linker.ld -o firmware.elf
```

組み込みのビルドには、スタートアップコード、リンカスクリプト、メモリ配置情報が加わる。ビルド結果も、OSが実行する一般的な実行ファイルではなく、ボードへ書き込む`.elf`、`.hex`、`.bin`ファイルになる場合が多い。

## 共通して必要なC言語の基礎

分野が異なっても、変数、関数、ポインタ、構造体といった文法の意味は同じである。

### データ型と整数の範囲

```c
#include <stdint.h>

int count = 10;
uint8_t sensor_value = 255u;
int16_t temperature_tenths = -35;  // -3.5°C
uint32_t elapsed_ms = 1000u;
```

`int`のサイズは実装によって異なる可能性がある。通信データやハードウェアレジスタのように正確なビット数が重要な場合は、`uint8_t`、`int16_t`、`uint32_t`のように幅が明確な整数型を使う。

組み込みでは、浮動小数点演算装置がない、または演算コストの高いMCUを考慮し、`23.7°C`を`237`として保存する**固定小数点方式**を使うことがある。業務系では、金額を`double`で処理すると生じる丸め誤差を避けるため、最小通貨単位の整数や専用の10進数処理方式を使う。

### 関数と戻り値

```c
#include <stdbool.h>

bool is_temperature_valid(int16_t value_tenths) {
    return value_tenths >= -400 && value_tenths <= 1250;
}
```

関数は入力と出力を明確に分ける最も基本的な単位である。組み込みでは関数の実行時間とスタック使用量も確認し、業務系ではエラーを返す規則と再利用性を特に重視する。

### 配列とポインタ

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

配列を関数へ渡すと、配列全体がコピーされるのではなく、先頭要素を指すポインタが渡される。そのため、ポインタだけでは長さが分からないので、`length`も一緒に渡す必要がある。

### 構造体と列挙型

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

構造体は、関連するデータを一つの意味のある単位にまとめる。組み込みではセンサー状態や通信フレームに、業務系では顧客・注文・取引レコードの表現に利用する。

## コードに表れる最も大きな違い

同じ「温度が基準を超えたら警告する」という要件を、二つの分野で実装してみよう。

### 組み込み系の例：センサーを周期的に確認する

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

このコードは100msごとにセンサーを読み、80.0°C以上になると警告出力を有効にする。温度が境界付近で揺れたときに出力が繰り返しオン・オフする現象を防ぐため、オフにする基準を78.0°Cへ下げる**ヒステリシス**も適用している。

ここで重要なのは次の点である。

- センサーとGPIOというハードウェア入出力がある。
- プログラムは終了せず、無限ループを繰り返す。
- 決められた周期で実行する必要がある。
- 浮動小数点ではなく0.1°C単位の整数を使う。
- 境界値付近に生じる実際のセンサーノイズを考慮する。

### 業務系の例：コマンドラインで受け取った温度を検査する

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

業務系の例では、コマンドラインから受け取った文字列を数値へ変換し、結果を出力する。実際のバッチプログラムでは、この入力がファイルやDBから読み込んだレコードになる場合もある。このコードで重要なのは次の点である。

- 利用者からの不正な入力を検査する。
- 成功と失敗を終了コードで外部プログラムに伝える。
- 標準入力・標準出力・標準エラー出力を使用する。
- 他のバッチ処理やシェルスクリプトと連携できる。
- プログラムは1件を処理して終了する。

二つの例はどちらも`if`文で温度を比較しているが、その周辺コードはまったく異なる。**組み込みコードは物理世界の状態と時間につながり、業務系コードはデータ形式と他のソフトウェアにつながる。**

## 組み込みCで特に重要な要素

### `volatile`の意味

```c
#include <stdint.h>

#define STATUS_REGISTER (*(volatile uint32_t *)0x40000000u)

uint32_t wait_until_ready(void) {
    while ((STATUS_REGISTER & 0x01u) == 0u) {
        // ハードウェアが値を変更するまで待機する。
    }

    return STATUS_REGISTER;
}
```

`volatile`は、その値が現在のコード以外の要因によって変化する可能性があるため、アクセスを勝手に削除したり統合したりしないようコンパイラへ伝える。ハードウェアレジスタや、割り込みと共有する単純なフラグに使われる。

ただし、`volatile`は次のことを保証しない。

- 複数の処理を一つのアトミック操作に変えるものではない。
- スレッドやコア間の同期を完成させるものではない。
- 競合状態を自動的に防ぐものではない。

並行して動く処理間でデータを安全に共有するには、アトミック操作、クリティカルセクション、ミューテックス、メッセージキューなど、実行環境に合った同期方法が必要である。

### 割り込みサービスルーチン

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

割り込み関数では、通常、フラグをクリアして必要な状態だけを記録し、素早く復帰する。時間のかかる計算、ブロッキングI/O、大量のログ出力は、メインループやRTOSタスクへ渡すほうが安全である。

実際のMCUでは、割り込みのネスト、アトミックに読み書きできるデータ型のサイズ、メモリバリアも追加で検討する必要がある。

### メモリマップとリンカ

マイクロコントローラには通常、コードと定数を保存するFlash、実行中のデータを置くRAM、周辺デバイスのレジスタ領域が分かれている。

```text
Flash:  プログラムコード、読み取り専用定数、初期値
RAM:    グローバル変数、static変数、ヒープ、スタック
MMIO:   GPIO、UART、ADCなどの周辺デバイスレジスタ
```

リンカスクリプトは、各セクションをどのアドレスに配置するかを決める。メモリの少ないデバイスでは、コンパイルの成功だけでなく、mapファイルで`.text`、`.data`、`.bss`、ヒープ、スタックのサイズも確認する。

### 動的メモリを慎重に扱う理由

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
        return NULL;  // 割り当て失敗を呼び出し元へ伝える。
    }

    buffer->length = 0u;
    return buffer;
}
```

`malloc`自体が常に禁止されるわけではない。しかし、長時間動作する小型デバイスでは、メモリ断片化、割り当て時間の変動、割り当て失敗への対応を理由に、動的割り当てを制限する設計が多い。

代替手段には次のものがある。

- サイズが決まった静的配列
- 初期化時に一度だけ割り当てる方法
- 固定サイズのメモリプール
- オブジェクトの所有権と寿命を明確にした専用アロケータ

### ステートマシン

組み込みプログラムでは、ステートマシンでデバイスの動作を表現することが多い。

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

状態と遷移条件を明確にすると、複雑な`if`文が各所へ分散することを防げる。また、ハードウェアがなくても、純粋関数として単体テストしやすくなる。

## 業務系Cで特に重要な要素

### 入力検証とエラー処理

Cには例外がないため、戻り値と出力引数によってエラーを伝える方式が一般的である。

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

`atoi`では失敗を区別しにくいため、検証が必要な場合は`strtol`系が適している。ポインタが`NULL`でないか、数値が範囲内か、文字列の最後まで正常に変換できたかをすべて確認する。

### 文字列とバッファサイズ

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

Cの文字列には、終端を表すヌル文字`\0`が必要である。バッファより長い文字列を書き込むとメモリ破壊が起きる可能性があるため、サイズも一緒に渡し、切り捨てが発生したかを確認する。

### ファイル処理とリソース解放

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

ファイル、ソケット、DB接続、動的メモリは、使用後に必ず解放しなければならない。関数の途中でエラーが発生しても解放処理が抜けないように、一つの終了経路を用意したり、小さな関数へ責務を分割したりする方法が有効である。

### データベースとトランザクション

業務系プログラムでは、複数のデータを一つの論理的な処理として更新する。例えば、注文の保存と在庫の減少のうち片方だけが成功すると、データに矛盾が生じる。

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

上記の関数は説明用の仮想APIである。実際には、PostgreSQLの`libpq`やSQLite C APIなど、利用するDBライブラリの規則に従う必要がある。重要なのは、関連する変更をトランザクションでまとめ、失敗時にはロールバックし、再試行したときに重複処理が起きないよう設計することである。

## メモリ管理方法の比較

### 記憶領域と寿命

```c
#include <stdlib.h>

static int global_counter;          // 静的記憶域期間

void example(void) {
    int local_value = 10;           // ブロックを抜けると寿命が終わる
    int *dynamic_value = malloc(sizeof(*dynamic_value));

    if (dynamic_value != NULL) {
        *dynamic_value = 20;
        free(dynamic_value);        // 解放後にアクセスしてはいけない
        dynamic_value = NULL;
    }
}
```

| 問題 | 組み込み系への影響 | 業務系への影響 |
| --- | --- | --- |
| メモリリーク | 再起動まで回復せず、長時間運転中に障害が発生 | サーバープロセスのメモリが増え続ける |
| バッファオーバーラン | レジスタや制御状態が破壊される可能性 | セキュリティ脆弱性、プロセス終了、データ破損 |
| 解放後の使用 | 予測困難なデバイス誤作動 | クラッシュまたはリモート攻撃の可能性 |
| 大きなスタック使用 | 小さなタスクスタックがすぐにあふれる可能性 | スレッド数が多い場合のメモリ消費増加 |

分野を問わず、メモリエラー検査ツールと静的解析を利用できる。PCで実行可能なモジュールは、GCCやClangのAddressSanitizer、UndefinedBehaviorSanitizerで検査し、組み込み専用コードでは静的解析とターゲットデバッガを併用する。

```bash
gcc -std=c17 -Wall -Wextra -Wpedantic \
  -fsanitize=address,undefined -g app.c -o app
```

## 並行処理と時間処理の比較

### 組み込みのリアルタイム性

リアルタイムシステムで重要なのは、単に平均速度が速いことではなく、**決められた最悪時間以内に応答すること**である。

- ハードリアルタイム: 締め切り違反が安全上の問題やシステム障害につながる可能性がある。
- ソフトリアルタイム: ときどき遅れることは許容されるが、品質が低下する。

割り込み優先度、タスク周期、最悪実行時間、共有リソースのロック時間を分析する必要がある。高優先度タスクが、低優先度タスクの持つロックによって待たされる優先度逆転も検討対象になる。

### 業務系の並行処理

業務系サーバーは、複数のリクエストと利用者を同時に処理する。このとき、次の問題が重要になる。

- 同じ在庫を二人の利用者が同時に減らす競合状態
- ロック順序の違いによって発生するデッドロック
- 重複リクエストで同じ取引が二重に反映される問題
- スループットを高めようとしてDBやネットワークがボトルネックになる問題

組み込みでの周期とdeadlineが、業務系ではトランザクション分離、タイムアウト、冪等性、スループットという設計課題に変わると考えられる。

## 通信コードに表れる違い

### 組み込み：バイト単位のプロトコル解析

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

組み込み通信では、バイト順、ビット配置、アライメント、チェックサム、フレーム長を正確に扱う。外部データを構造体ポインタへ直接キャストすると、アライメント、padding、endianの違いによって移植性が失われる可能性があるため、バイトを明示的に組み立てるほうが安全である。

### 業務系：レコード単位のデータ解析

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

実際の業務データでは、CSV内の引用符や改行、文字エンコーディング、フィールド数、最大長を処理する必要があるため、検証済みのCSV/JSONライブラリを利用するほうがよい。この例は、レコード単位の処理方法だけを単純化して示している。

## 設計とコーディング規則の違い

### 組み込み系でよく確認する基準

- ハードウェアのデータシートと回路図に合っているか。
- 制限されたRAMとFlashに収まるか。
- 最悪実行時間と応答周期を守れるか。
- 電源断や通信エラーの後、安全な状態へ戻れるか。
- 整数overflow、bit shift、型変換が意図どおりに動作するか。
- コンパイラやMCUが変わっても移植できるか。

自動車など安全性が重要な分野では、MISRA C、CERT Cなどの規則や、プロジェクト固有のコーディング規約を適用することがある。

### 業務系でよく確認する基準

- 要件と業務ルールを正確に反映しているか。
- 入力エラーと外部システムの障害を処理できるか。
- トランザクションとデータ整合性が保証されるか。
- ログだけで障害原因を追跡できるか。
- 長期間にわたって変更しやすい構造か。
- 個人情報と認証情報を安全に扱っているか。

共通点も多い。警告のないビルド、明確なインターフェース、小さな関数、境界値検査、自動テストは、どの分野でも重要である。

## テスト方法の違い

### 共通ロジックをハードウェアから分離する

先ほどの状態遷移関数のように、計算ロジックとハードウェアアクセスを分離すると、PC上でもテストできる。

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

### 組み込みテスト

1. 純粋なロジックをPC上で単体テストする。
2. ハードウェア抽象化層をmockまたはfakeへ置き換える。
3. 開発ボード上でドライバと周辺デバイスを結合テストする。
4. 実際の信号を入力するHIL（Hardware-in-the-Loop）テストを行う。
5. 境界温度、低電圧、通信切断、センサー故障などの異常状態を確認する。

### 業務系テスト

1. パース処理と計算関数を単体テストする。
2. ファイル、DB、API連携を結合テストする。
3. 実際の業務シナリオで受け入れテストを行う。
4. 多数のリクエストと大容量データで負荷テストする。
5. 権限エラー、重複リクエスト、ネットワークタイムアウト、ロールバックを確認する。

## デバッグツールの違い

| 目的 | 組み込み系 | 業務系 |
| --- | --- | --- |
| コード停止・変数確認 | JTAG/SWDデバッガ、GDB | GDB、IDEデバッガ |
| ログ | UART、RTT、制限されたデバイスログ | ファイル、標準出力、集中ログシステム |
| 信号確認 | オシロスコープ、ロジックアナライザ | ネットワークキャプチャ、APIトレース |
| メモリエラー | 静的解析、ターゲット検査、ホストsanitizer | sanitizer、Valgrind、静的解析 |
| 性能 | 周期測定、GPIOトグル、trace | profiler、APM、DB実行計画 |

組み込みでは、ログ1行がタイミングへ影響することもある。業務系では、注文番号やリクエストIDなどの追跡情報をログへ残しつつ、個人情報や秘密情報は記録しないようにする。

## プロジェクト構成例

### 組み込みプロジェクト

```text
firmware/
├── application/     ステートマシンと製品ロジック
├── drivers/         GPIO、UART、ADCドライバ
├── hal/             ハードウェア抽象化層
├── platform/        スタートアップコードとMCU別設定
├── tests/           ホスト単体テスト
├── linker/          リンカスクリプト
└── CMakeLists.txt
```

### 業務系Cプロジェクト

```text
order-service/
├── include/         公開ヘッダー
├── src/             業務ロジックと実装
├── adapters/        DB、ファイル、ネットワーク連携
├── tests/           単体・結合テスト
├── config/          実行環境の設定
└── CMakeLists.txt
```

どちらの構成でも、コアロジックと外部依存を分離する。違いは、外部依存がハードウェアなのか、DB・ファイル・ネットワークなのかという点にある。

## 分野別の学習順序

### 共通基盤

1. 変数、条件分岐、繰り返し、関数
2. 配列、文字列、ポインタ
3. 構造体、列挙型、ビット演算
4. ヘッダーファイルと分割コンパイル
5. メモリの寿命とエラー処理
6. MakeまたはCMake、デバッガ、Git
7. 単体テストと静的解析

### 組み込み系を目指す場合

1. デジタル論理とコンピュータアーキテクチャを学ぶ。
2. MCUのGPIO、timer、UART、ADCを使用する。
3. データシートと回路図を読む。
4. 割り込み、`volatile`、メモリマップを理解する。
5. ステートマシンと非同期イベント処理を練習する。
6. RTOSのタスク、キュー、semaphoreを学ぶ。
7. JTAG/SWDとロジックアナライザでデバッグする。

最初はLED点滅から一歩進み、ボタンのdebounce、温度測定、UARTコマンド処理、センサーエラーからの復旧まで含めた小さなデバイスを作るとよい。

### 業務系を目指す場合

1. 文字列とファイルを安全に処理する。
2. プロセス、スレッド、ソケットなどのLinuxプログラミングを学ぶ。
3. SQLとトランザクションを理解する。
4. HTTP、JSON、文字エンコーディングを学ぶ。
5. ログ、設定、バッチ処理、エラー復旧を実装する。
6. セキュアな入力検証と権限処理を学ぶ。
7. CプログラムをJavaやPythonなどと連携させる。

ただし、新規の業務Webシステムだけを目指すなら、CよりJava/SpringまたはC#/.NETを先に学ぶほうが、実務の機会は多い。Cは、OSに近い処理、既存資産の保守、性能が重要なモジュールという強みと組み合わせるとよい。

## どの分野が自分に合うか

| このような作業が楽しい場合 | より近い分野 |
| --- | --- |
| センサー値を読み、実際のデバイスを動かす | 組み込み・制御系 |
| ビット、メモリ、CPUの動作を深く理解する | 組み込み・システム系 |
| 受注・在庫・決済などの業務フローを設計する | 業務系 |
| DBとAPIを連携し、多数のユーザーを処理する | 業務系・Webバックエンド |
| 性能ボトルネックを探し、ネイティブモジュールを最適化する | システム系・業務系共通 |

どちらの分野が優れているということではない。組み込みの経験からは、ハードウェアへの理解、リソース制約、安全な状態処理を学べる。業務系の経験からは、データモデリング、トランザクション、ユーザー要件、大規模運用を学べる。長期的には、IoTデバイスのファームウェアと、それを管理するバックエンドの両方を理解する**IoTフルスタック**も強い組み合わせになる。

{{< conclusion >}}
**結論:** Cの文法は同じでも、組み込み系ではハードウェア・メモリ・リアルタイム性・安全な復旧が、業務系では入力・データ整合性・外部連携・保守性が中心になる。最初に共通するCの基礎を固めた後、組み込みはMCUプロジェクト、業務系はLinux・ファイル・DBプロジェクトで実践すると、コードの違いを最も早く体感できる。
{{< /conclusion >}}

## 参考資料

- [ISO/IEC 9899:2024 - Programming languages — C](https://www.iso.org/standard/82075.html)
- [GCC - Standards Supported by GCC](https://gcc.gnu.org/onlinedocs/gcc/Standards.html)
- [GCC - Options Controlling C Dialect](https://gcc.gnu.org/onlinedocs/gcc/C-Dialect-Options.html)
- [FreeRTOS Documentation](https://www.freertos.org/Documentation/RTOS_book.html)
- [SEI CERT C Coding Standard](https://wiki.sei.cmu.edu/confluence/display/c/SEI+CERT+C+Coding+Standard)
- [PostgreSQL - libpq C Library](https://www.postgresql.org/docs/current/libpq.html)
- [SQLite C/C++ Interface](https://www.sqlite.org/cintro.html)
