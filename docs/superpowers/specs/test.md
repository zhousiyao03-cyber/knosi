# Golang 学习笔记：基础语法

## 1. Golang 简介

Golang（Go）是 Google 开发的一门静态类型、编译型语言，特点包括：

- 语法简洁，学习曲线平滑
- 编译速度快
- 原生支持并发
- 内置垃圾回收
- 适合构建后端服务、云原生应用、工具链程序

**适用场景：**

- Web 后端开发
- 微服务
- 命令行工具
- 网络编程
- 高并发系统

---

## 2. Go 程序基本结构

一个最简单的 Go 程序如下：

```go
package main

import "fmt"

func main() {
    fmt.Println("Hello, Go!")
}
```

### 说明

- `package main`：声明当前程序属于 `main` 包，表示可执行程序入口
- `import "fmt"`：导入标准库 `fmt`
- `func main()`：程序入口函数
- `fmt.Println(...)`：输出内容到控制台

---

## 3. 变量与常量

### 3.1 变量声明

Go 支持多种变量声明方式：

```go
var name string = "Tom"
var age int = 18
```

类型可省略，由编译器推断：

```go
var city = "Beijing"
```

在函数内部可使用短变量声明：

```go
score := 95
```

### 3.2 多变量声明

```go
var a, b int = 1, 2
x, y := "Go", true
```

### 3.3 常量

```go
const Pi = 3.14
const AppName = "GoDemo"
```

常量一般用于不会变化的值。

---

## 4. 基本数据类型

Go 的常用基础语法内容之一就是数据类型。

### 4.1 整型

```go
var a int = 10
var b int64 = 100
```

### 4.2 浮点型

```go
var price float32 = 19.9
var rate float64 = 3.14159
```

### 4.3 布尔型

```go
var isOk bool = true
```

### 4.4 字符串

```go
var s string = "hello"
```

### 4.5 字符与字节

```go
var c byte = 'A'
var r rune = '中'
```

- `byte` 常用于 ASCII 字符
- `rune` 用于表示 Unicode 字符

---

## 5. 输入与输出

### 5.1 输出

```go
fmt.Println("Hello")
fmt.Printf("姓名：%s，年龄：%d\n", "Tom", 18)
```

### 5.2 输入

```go
package main

import "fmt"

func main() {
    var name string
    var age int
    fmt.Scan(&name, &age)
    fmt.Println("姓名：", name, "年龄：", age)
}
```

注意：`Scan` 传入的是变量地址。

---

## 6. 运算符

### 6.1 算术运算符

```go
a, b := 10, 3
fmt.Println(a + b)
fmt.Println(a - b)
fmt.Println(a * b)
fmt.Println(a / b)
fmt.Println(a % b)
```

### 6.2 比较运算符

```go
fmt.Println(a == b)
fmt.Println(a != b)
fmt.Println(a > b)
fmt.Println(a < b)
```

### 6.3 逻辑运算符

```go
x, y := true, false
fmt.Println(x && y)
fmt.Println(x || y)
fmt.Println(!x)
```

---

## 7. 流程控制

### 7.1 if 条件语句

```go
age := 20
if age >= 18 {
    fmt.Println("成年人")
} else {
    fmt.Println("未成年人")
}
```

Go 支持在 `if` 中先执行语句：

```go
if score := 85; score >= 60 {
    fmt.Println("及格")
}
```

### 7.2 switch 语句

```go
day := 2
switch day {
case 1:
    fmt.Println("Monday")
case 2:
    fmt.Println("Tuesday")
default:
    fmt.Println("Other")
}
```

特点：

- 默认自带 `break`
- 可不写表达式，作为条件判断使用

```go
score := 90
switch {
case score >= 90:
    fmt.Println("优秀")
case score >= 60:
    fmt.Println("及格")
default:
    fmt.Println("不及格")
}
```

### 7.3 for 循环

Go 只有 `for`，没有 `while`。

#### 基本形式

```go
for i := 0; i < 5; i++ {
    fmt.Println(i)
}
```

#### 类似 while

```go
i := 0
for i < 5 {
    fmt.Println(i)
    i++
}
```

#### 无限循环

```go
for {
    fmt.Println("loop")
    break
}
```

---

## 8. 数组、切片与 map

这是 Go 基础语法中的重点内容。

### 8.1 数组

数组长度固定。

```go
var nums [3]int = [3]int{1, 2, 3}
fmt.Println(nums)
```

### 8.2 切片

切片比数组更常用，长度可变。

```go
nums := []int{1, 2, 3}
nums = append(nums, 4)
fmt.Println(nums)
```

#### 切片截取

```go
a := []int{1, 2, 3, 4, 5}
fmt.Println(a[1:4])
```

### 8.3 map

`map` 是键值对集合。

```go
m := map[string]int{
    "Tom":  90,
    "Lucy": 95,
}
fmt.Println(m["Tom"])
```

判断键是否存在：

```go
score, ok := m["Jack"]
if ok {
    fmt.Println(score)
} else {
    fmt.Println("不存在")
}
```

---

## 9. 函数

函数是 Go 编程的核心。

### 9.1 基本函数定义

```go
func add(a int, b int) int {
    return a + b
}
```

简写形式：

```go
func add(a, b int) int {
    return a + b
}
```

### 9.2 多返回值

Go 支持多返回值。

```go
func calc(a, b int) (int, int) {
    return a + b, a - b
}
```

调用：

```go
sum, diff := calc(10, 5)
fmt.Println(sum, diff)
```

### 9.3 命名返回值

```go
func divide(a, b float64) (result float64) {
    result = a / b
    return
}
```

### 9.4 可变参数

```go
func sum(nums ...int) int {
    total := 0
    for _, v := range nums {
        total += v
    }
    return total
}
```

---

## 10. 指针基础

Go 支持指针，但不支持指针运算。

```go
package main

import "fmt"

func main() {
    a := 10
    p := &a
    fmt.Println(*p)
    *p = 20
    fmt.Println(a)
}
```

### 说明

- `&a`：获取变量地址
- `p`：保存地址的指针变量
- `*p`：解引用，访问指针指向的值

---

## 11. 结构体

结构体用于组织不同类型的数据。

```go
type Person struct {
    Name string
    Age  int
}

func main() {
    p := Person{Name: "Tom", Age: 18}
    fmt.Println(p.Name, p.Age)
}
```

### 修改结构体字段

```go
p.Age = 20
```

### 结构体指针

```go
pp := &Person{Name: "Lucy", Age: 22}
fmt.Println(pp.Name)
```

Go 会自动解引用，使用方便。

---

## 12. 方法

方法本质上是绑定到某种类型上的函数。

```go
type Rectangle struct {
    Width  float64
    Height float64
}

func (r Rectangle) Area() float64 {
    return r.Width * r.Height
}
```

调用：

```go
rect := Rectangle{Width: 5, Height: 3}
fmt.Println(rect.Area())
```

---

## 13. package 与 import

Go 使用包来组织代码。

### 包规则

- 每个 Go 文件都属于一个包
- 可执行程序入口必须是 `package main`
- 包名通常与目录名一致

### 导入多个包

```go
import (
    "fmt"
    "math"
)
```

使用示例：

```go
fmt.Println(math.Sqrt(16))
```

---

## 14. 错误处理基础

Go 不使用异常作为主要错误处理方式，而是通过返回 `error`。

```go
package main

import (
    "errors"
    "fmt"
)

func divide(a, b float64) (float64, error) {
    if b == 0 {
        return 0, errors.New("除数不能为0")
    }
    return a / b, nil
}

func main() {
    result, err := divide(10, 0)
    if err != nil {
        fmt.Println("错误：", err)
        return
    }
    fmt.Println(result)
}
```

---

## 15. range 用法

`range` 常用于遍历数组、切片、map、字符串。

### 遍历切片

```go
nums := []int{10, 20, 30}
for i, v := range nums {
    fmt.Println(i, v)
}
```

### 遍历 map

```go
m := map[string]int{"Tom": 90, "Lucy": 95}
for k, v := range m {
    fmt.Println(k, v)
}
```

### 遍历字符串

```go
s := "Go语言"
for i, r := range s {
    fmt.Println(i, string(r))
}
```

---

## 16. 实用示例：学生成绩管理

下面的例子综合使用了变量、map、函数、流程控制等基础语法。

```go
package main

import "fmt"

func main() {
    scores := map[string]int{
        "Tom":  80,
        "Lucy": 92,
        "Jack": 58,
    }

    for name, score := range scores {
        fmt.Printf("%s 的成绩是 %d，等级：%s\n", name, score, level(score))
    }
}

func level(score int) string {
    switch {
    case score >= 90:
        return "优秀"
    case score >= 60:
        return "及格"
    default:
        return "不及格"
    }
}
```

### 运行结果示例

```text
Tom 的成绩是 80，等级：及格
Lucy 的成绩是 92，等级：优秀
Jack 的成绩是 58，等级：不及格
```

---

## 17. 学习基础语法时的常见注意点

### 17.1 花括号不能省略

Go 中 `if`、`for`、`switch` 后的 `{}` 不能省略。

### 17.2 语句结尾通常不需要分号

Go 编译器会自动插入分号。

### 17.3 未使用的变量会报错

```go
x := 10 // 如果不使用，会编译报错
```

### 17.4 大写字母开头表示可导出

```go
type Student struct {
    Name string // 可导出
    age  int    // 不可导出
}
```

---

## 18. 基础语法学习路线建议

学习 Golang 时，可以按以下顺序掌握：

1. 程序结构与开发环境
2. 变量、常量、数据类型
3. 运算符与流程控制
4. 数组、切片、map
5. 函数与错误处理
6. 指针、结构体、方法
7. 包管理与模块化开发

建议每学完一个知识点就写一个小程序，例如：

- 计算器
- 登录判断程序
- 学生成绩统计
- 命令行记事本

---

## 19. 总结

Golang 的**基础语法**具有简洁、清晰、实用的特点。学习时应重点掌握：

- 变量与常量
- 数据类型
- 条件与循环
- 切片与 map
- 函数与多返回值
- 指针与结构体
- 错误处理

打好基础语法后，再继续深入学习：

- 接口
- goroutine 和 channel
- 文件操作
- Web 开发
- 标准库与工程实践

> 建议：多写代码、多运行、多调试，是掌握 Go 最有效的方法。
