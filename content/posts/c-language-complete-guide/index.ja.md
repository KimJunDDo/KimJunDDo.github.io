---
title: "C言語を一度に学ぶ：基本文法からポインタとソートアルゴリズムまで"
date: 2026-09-03
draft: false
description: "C言語のプログラム構造、データ型、制御文、関数、配列、ポインタ、動的メモリ、構造体、ファイル処理、基本アルゴリズムを例とともに解説します。"
tags: ["C", "Programming Basics", "Pointer", "Data Structure", "Algorithm"]
categories: ["C"]
showTableOfContents: true
---

C言語は、OS、組み込みファームウェア、ドライバ、データベース、高性能ライブラリの基盤として利用されている。文法自体は比較的小さいが、データ型とメモリを開発者が直接扱うため、コンピュータがプログラムを実行する仕組みを深く理解できる。

この記事は、Cを初めて学ぶ人が上から順に読み進められるように構成した。最後には線形探索、二分探索、バブル・選択・挿入・マージ・クイックソートなどの基本アルゴリズムをCで実装する。

{{< conclusion >}}
**要点:** Cで最も重要なのは、文法の暗記ではなく、**データ型、メモリの寿命、配列とポインタの関係、関数の入力と出力**を正確に理解することである。実際にコンパイルし、警告を一つずつ解決しながら学習すると理解が早い。
{{< /conclusion >}}

## 開発環境と最初のプログラム

### コンパイルの流れ

Cソースはそのまま実行されず、プリプロセス、コンパイル、アセンブル、リンクを経て実行ファイルになる。

```text
main.c → プリプロセス → コンパイル → アセンブル → リンク → 実行ファイル
```

```bash
gcc -std=c17 -Wall -Wextra -Wpedantic main.c -o main
./main
```

`-std=c17`はC17規格、警告オプションはミスの発見、`-o main`は出力名の指定である。

### Hello, World

```c
#include <stdio.h>

int main(void) {
    printf("Hello, C!\n");
    return 0;
}
```

`stdio.h`は標準入出力関数の宣言を提供する。処理は`main`から始まり、`\n`は改行、`return 0`は正常終了を表す。

## 変数、定数、データ型

### 宣言と基本型

```c
int age = 25;
double height = 175.5;
char grade = 'A';
```

変数は、値を保存する名前付きのメモリ領域である。未初期化のローカル変数を読み取ると未定義動作になる可能性があるため、宣言と同時に初期化する。

| 型 | 主な用途 | `printf` |
| --- | --- | --- |
| `char` | 文字、小さな整数 | `%c` |
| `int` | 一般的な整数 | `%d` |
| `unsigned int` | 0以上の整数 | `%u` |
| `long long` | 大きな整数 | `%lld` |
| `float` | 単精度実数 | `%f` |
| `double` | 倍精度実数 | `%f` |

型のサイズは`sizeof`で確認する。通信データなどで正確なビット幅が必要なら、`<stdint.h>`の`int32_t`や`uint8_t`を使う。

```c
printf("int: %zu bytes\n", sizeof(int));
```

### 定数と型変換

```c
const double pi = 3.141592653589793;
#define MAX_USERS 100

int total = 7;
int count = 2;
double average = (double)total / count;
```

整数同士の除算では小数部分が切り捨てられる。`double`へ明示的に変換すると、この例は`3.5`になる。`const`には型があるが、マクロはプリプロセス時のテキスト置換である。

## 入力と出力

```c
#include <stdio.h>

int main(void) {
    int number;
    printf("整数を入力: ");

    if (scanf("%d", &number) != 1) {
        fprintf(stderr, "正しい整数ではありません。\n");
        return 1;
    }

    printf("入力値: %d\n", number);
    return 0;
}
```

`scanf`には格納先の**アドレス**を渡すため、`&number`と書く。戻り値は正常に読み取った項目数なので必ず確認する。空白を含む文字列では、バッファ長を指定できる`fgets`が扱いやすい。

```c
char name[50];
if (fgets(name, sizeof(name), stdin) == NULL) return 1;
```

## 演算子

```c
int a = 10;
int b = 3;

printf("%d\n", a / b);  // 3
printf("%d\n", a % b);  // 1

bool in_range = a >= 0 && a <= 100;
```

`&&`はAND、`||`はOR、`!`はNOTである。`&&`と`||`は結果が確定した時点で右側を評価しない短絡評価を行う。

```c
if (pointer != NULL && *pointer > 0) {
    /* NULLの場合、右側は評価されない */
}
```

ビット演算はレジスタやフラグ操作に使われる。

```c
flags |= (1u << 2);    // ビットを立てる
flags &= ~(1u << 2);   // ビットを下げる
flags ^= (1u << 1);    // ビットを反転する
```

## 条件分岐と繰り返し

### `if`と`switch`

```c
if (score >= 90) {
    printf("A\n");
} else if (score >= 80) {
    printf("B\n");
} else {
    printf("C\n");
}
```

`=`は代入、`==`は比較である。複数の整数値から処理を選ぶ場合は`switch`も利用できる。

```c
switch (menu) {
    case 1:
        printf("検索\n");
        break;
    case 2:
        printf("登録\n");
        break;
    default:
        printf("不正なメニュー\n");
        break;
}
```

### `for`と`while`

```c
for (int i = 0; i < 5; ++i) {
    printf("%d ", i);
}

while (count > 0) {
    --count;
}
```

回数が明確なら`for`、条件によって継続するなら`while`が読みやすい。`break`はループを終了し、`continue`は現在の反復の残りを飛ばす。

## 関数

```c
int add(int left, int right);  // 宣言

int add(int left, int right) { // 定義
    return left + right;
}
```

Cの引数は値としてコピーされる。呼び出し元の値を変更するには、そのアドレスを渡す。

```c
void swap(int *left, int *right) {
    int temporary = *left;
    *left = *right;
    *right = temporary;
}
```

再帰関数には必ず終了条件が必要であり、呼び出しごとにスタックを使う。

```c
unsigned long long factorial(unsigned int n) {
    if (n <= 1u) return 1u;
    return n * factorial(n - 1u);
}
```

## 変数のスコープと記憶域期間

```c
static int file_counter = 0;

void count_call(void) {
    static int calls = 0;
    int local = 10;
    ++calls;
    ++file_counter;
}
```

ローカル変数はブロック内だけで見える。関数内の`static`変数は値を保持し、ファイルスコープの変数や関数に`static`を付けると他のソースファイルへ公開されない。グローバル変数は依存関係を増やすため最小限にする。

## 配列

```c
int scores[5] = {90, 85, 70, 95, 88};
size_t length = sizeof(scores) / sizeof(scores[0]);

for (size_t i = 0; i < length; ++i) {
    printf("%d\n", scores[i]);
}
```

添字は0から始まり、範囲外アクセスは未定義動作である。`sizeof`による要素数計算は実体の配列にだけ使え、関数へ渡されたポインタには使えない。

```c
int matrix[2][3] = {
    {1, 2, 3},
    {4, 5, 6}
};
```

多次元配列は行優先で連続配置される。関数へ渡す場合は、後ろの次元を`int matrix[][3]`のように指定する。

## 文字列

Cでは、**ヌル文字`\0`で終わる`char`配列**を文字列として使う。

```c
char name[] = "Kim";  // {'K', 'i', 'm', '\0'}
```

```c
#include <string.h>

size_t length = strlen(name);
bool same = strcmp(name, "Kim") == 0;
```

コピーや連結では、書き込み先のサイズを超えないようにする。文字列を組み立てる場合は`snprintf`が便利である。

```c
char label[32];
int written = snprintf(label, sizeof(label), "USER-%04d", 25);
if (written < 0 || (size_t)written >= sizeof(label)) {
    /* エラーまたは切り捨て */
}
```

## ポインタ

### アドレスと間接参照

```c
int number = 10;
int *pointer = &number;

printf("%d\n", *pointer);
*pointer = 20;
```

`&number`はアドレス、`int *`は`int`を指すポインタ、`*pointer`は指している値へのアクセスである。間接参照前に、有効なオブジェクトを指しているか確認する。

### 配列との関係

```c
int values[] = {10, 20, 30};
int *p = values;

printf("%d\n", p[1]);
printf("%d\n", *(p + 1));
```

多くの式で配列名は先頭要素へのポインタへ変換される。ただし、配列は記憶領域全体を所有し、`sizeof(values)`は全体のサイズになる一方、`sizeof(p)`はポインタのサイズになる。

```c
const int *read_only_value;
int *const fixed_pointer = &number;
```

最初は指す値を変更しないポインタ、次は指すアドレスを変更しないポインタである。

## 動的メモリ

```c
#include <stdlib.h>

size_t count = 5;
int *numbers = calloc(count, sizeof(*numbers));
if (numbers == NULL) return 1;

for (size_t i = 0; i < count; ++i) {
    numbers[i] = (int)(i * 10);
}

free(numbers);
numbers = NULL;
```

`malloc`は未初期化領域、`calloc`は0で初期化した領域を確保する。`realloc`はサイズ変更、`free`は解放を行う。メモリリーク、二重解放、解放後の使用、範囲外アクセスを避け、所有者と寿命を明確にする。

```c
int *temporary = realloc(numbers, new_count * sizeof(*numbers));
if (temporary != NULL) {
    numbers = temporary;
}
```

一時ポインタを使うことで、`realloc`失敗時に元のアドレスを失わずに済む。

## 構造体、列挙型、共用体

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
```

構造体は関連データをまとめる。構造体ポインタのメンバは`student->id`のように`->`で参照する。

```c
typedef enum {
    STATUS_IDLE,
    STATUS_RUNNING,
    STATUS_ERROR
} Status;

typedef union {
    int integer;
    float real;
    unsigned char bytes[4];
} Value;
```

`enum`は関連する整数定数に名前を付ける。`union`のメンバは同じメモリを共有するため、どのメンバが現在有効かを別のタグで管理する。

## プリプロセッサとヘッダーファイル

```c
#define SQUARE(x) ((x) * (x))
```

マクロは`SQUARE(i++)`のような副作用のある式を渡すと複数回評価される。可能なら型検査が働く`static inline`関数を使う。

```c
static inline int square(int value) {
    return value * value;
}
```

ヘッダーには外部公開する宣言、`.c`ファイルには実装を書く。include guardは重複した読み込みを防ぐ。

```c
#ifndef CALCULATOR_H
#define CALCULATOR_H

int add(int left, int right);

#endif
```

## ファイル入出力

```c
#include <stdio.h>

int main(void) {
    FILE *file = fopen("scores.txt", "w");
    if (file == NULL) {
        perror("fopen");
        return 1;
    }

    fprintf(file, "%s,%d\n", "Kim", 95);

    if (fclose(file) != 0) {
        perror("fclose");
        return 1;
    }
    return 0;
}
```

`r`は読み取り、`w`は既存内容を消して書き込み、`a`は末尾への追加である。テキスト行には`fgets`、バイナリブロックには`fread`と`fwrite`を使い、すべての結果を確認する。

## エラー処理と安全なC

```c
errno = 0;
char *end = NULL;
long value = strtol(text, &end, 10);

if (errno != 0 || end == text || *end != '\0' ||
    value < INT_MIN || value > INT_MAX) {
    return 0;
}
```

`atoi`はエラーを区別しにくい。入力検証には、終了位置と範囲エラーを確認できる`strtol`が適している。

配列範囲外アクセス、`NULL`の間接参照、解放後の使用、signed整数overflowなどは未定義動作である。警告、静的解析、sanitizerを活用する。

```bash
gcc -std=c17 -Wall -Wextra -Wpedantic \
  -fsanitize=address,undefined -g main.c -o main
```

## 基本データ構造

### 連結リスト

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

各ノードが次のノードのアドレスを持つ。位置が分かっている場合の挿入・削除は速いが、検索には先頭からの走査が必要である。

### 配列によるスタック

```c
#define STACK_CAPACITY 100

typedef struct {
    int data[STACK_CAPACITY];
    size_t size;
} Stack;

bool stack_push(Stack *stack, int value) {
    if (stack == NULL || stack->size == STACK_CAPACITY) return false;
    stack->data[stack->size++] = value;
    return true;
}

bool stack_pop(Stack *stack, int *value) {
    if (stack == NULL || value == NULL || stack->size == 0u) return false;
    *value = stack->data[--stack->size];
    return true;
}
```

スタックは後から入れた値を先に取り出すLIFO構造であり、関数呼び出し、括弧検査、深さ優先探索などで利用される。

## アルゴリズムと計算量

| 計算量 | 意味 | 例 |
| --- | --- | --- |
| `O(1)` | 入力サイズによらず一定 | 配列の添字アクセス |
| `O(log n)` | 範囲を段階的に縮小 | 二分探索 |
| `O(n)` | 全要素を一度確認 | 線形探索 |
| `O(n log n)` | 効率的な比較ソート | マージソート |
| `O(n²)` | 要素の組を繰り返し比較 | 単純なソート |

Big-Oだけでなく、追加メモリ、入力の特徴、安定ソートかどうかも確認する。

## 探索アルゴリズム

### 線形探索

```c
int linear_search(const int values[], size_t length, int target) {
    for (size_t i = 0; i < length; ++i) {
        if (values[i] == target) return (int)i;
    }
    return -1;
}
```

未ソートの配列にも利用でき、計算量は`O(n)`である。

### 二分探索

```c
int binary_search(const int values[], size_t length, int target) {
    size_t left = 0;
    size_t right = length;

    while (left < right) {
        size_t middle = left + (right - left) / 2;
        if (values[middle] == target) return (int)middle;
        if (values[middle] < target) left = middle + 1;
        else right = middle;
    }
    return -1;
}
```

**昇順にソート済みの配列**が必要であり、計算量は`O(log n)`である。区間を`[left, right)`として管理すると境界が分かりやすい。

## 基本ソートアルゴリズム

### バブルソート

```c
void bubble_sort(int values[], size_t length) {
    for (size_t end = length; end > 1; --end) {
        bool swapped = false;
        for (size_t i = 1; i < end; ++i) {
            if (values[i - 1] > values[i]) {
                int temp = values[i - 1];
                values[i - 1] = values[i];
                values[i] = temp;
                swapped = true;
            }
        }
        if (!swapped) break;
    }
}
```

隣接要素を交換し、大きな値を後ろへ送る。安定ソートだが平均・最悪とも`O(n²)`である。

### 選択ソート

```c
void selection_sort(int values[], size_t length) {
    for (size_t i = 0; i < length; ++i) {
        size_t minimum = i;
        for (size_t j = i + 1; j < length; ++j) {
            if (values[j] < values[minimum]) minimum = j;
        }
        if (minimum != i) {
            int temp = values[i];
            values[i] = values[minimum];
            values[minimum] = temp;
        }
    }
}
```

未ソート区間の最小値を前へ移す。比較は`O(n²)`で、一般的な実装は安定ではないが交換回数は少ない。

### 挿入ソート

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

前方のソート済み区間へ値を挿入する。最悪は`O(n²)`だが、ほぼ整列済みの小さな配列では速く、安定である。

### マージソート

```c
static void merge(int a[], int temp[], size_t l, size_t m, size_t r) {
    size_t i = l, j = m, k = l;
    while (i < m && j < r) temp[k++] = a[i] <= a[j] ? a[i++] : a[j++];
    while (i < m) temp[k++] = a[i++];
    while (j < r) temp[k++] = a[j++];
    for (size_t n = l; n < r; ++n) a[n] = temp[n];
}

static void merge_range(int a[], int temp[], size_t l, size_t r) {
    if (r - l < 2) return;
    size_t m = l + (r - l) / 2;
    merge_range(a, temp, l, m);
    merge_range(a, temp, m, r);
    merge(a, temp, l, m, r);
}

void merge_sort(int a[], size_t length) {
    int *temp = malloc(length * sizeof(*temp));
    if (temp == NULL && length != 0u) return;
    merge_range(a, temp, 0, length);
    free(temp);
}
```

配列を半分に分割し、ソート済みの区間を結合する。常に`O(n log n)`で安定だが、`O(n)`の追加メモリを使う。

### クイックソートと標準関数

クイックソートはpivotを基準に小さい値と大きい値へ分け、各区間を再帰的に処理する。平均は`O(n log n)`、最悪は`O(n²)`で、通常は安定ではない。標準ライブラリには汎用関数`qsort`がある。

```c
int compare_int(const void *left, const void *right) {
    int a = *(const int *)left;
    int b = *(const int *)right;
    return (a > b) - (a < b);
}

qsort(values, length, sizeof(values[0]), compare_int);
```

単純な引き算で比較結果を返すと整数overflowの可能性があるため、関係演算を使っている。

| アルゴリズム | 平均 | 最悪 | 追加領域 | 安定 |
| --- | --- | --- | --- | --- |
| バブル | `O(n²)` | `O(n²)` | `O(1)` | はい |
| 選択 | `O(n²)` | `O(n²)` | `O(1)` | いいえ |
| 挿入 | `O(n²)` | `O(n²)` | `O(1)` | はい |
| マージ | `O(n log n)` | `O(n log n)` | `O(n)` | はい |
| クイック | `O(n log n)` | `O(n²)` | 再帰スタック | いいえ |

## その他の基本アルゴリズム

### 最大公約数

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

ユークリッドの互除法は`gcd(a, b) = gcd(b, a % b)`を繰り返し利用し、おおよそ`O(log min(a, b))`で動く。

### 素数判定

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

約数は平方根まで調べればよい。`divisor * divisor`ではなく除算を使い、乗算overflowの可能性を避けている。

## 学習順序と練習課題

1. 入出力、条件分岐、ループで数当てゲームを作る。
2. 関数と配列で点数の合計・平均・最大値を求める。
3. ライブラリを使わず`strlen`と文字列反転を実装する。
4. ポインタで`swap`と配列走査関数を書く。
5. 構造体配列で学生管理プログラムを作る。
6. データをファイルへ保存し、読み戻す。
7. 連結リストとスタックを実装する。
8. 各ソートの比較回数を測る。
9. 線形探索と二分探索の実行回数を比較する。
10. AddressSanitizerでメモリエラーを発見する。

最初からすべてを暗記する必要はない。入力と出力、配列の長さ、ポインタの有効性、メモリの所有権を紙に描き、一行ずつ追跡すると理解が速くなる。

{{< conclusion >}}
**結論:** C学習の中心は制御文そのものより、データ型とメモリにある。基本文法の後に配列・ポインタ・構造体・動的メモリを関連づけ、探索とソートを自分で実装すると、文法が問題解決にどう使われるかをまとめて理解できる。
{{< /conclusion >}}

## 参考資料

- [ISO/IEC 9899:2024 - Programming languages — C](https://www.iso.org/standard/82075.html)
- [GCC - C Dialect Options](https://gcc.gnu.org/onlinedocs/gcc/C-Dialect-Options.html)
- [GCC - Warning Options](https://gcc.gnu.org/onlinedocs/gcc/Warning-Options.html)
- [GNU C Library Manual](https://sourceware.org/glibc/manual/latest/html_mono/libc.html)
- [SEI CERT C Coding Standard](https://wiki.sei.cmu.edu/confluence/display/c/SEI+CERT+C+Coding+Standard)
