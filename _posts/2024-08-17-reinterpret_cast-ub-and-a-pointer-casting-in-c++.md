---
layout: post
title:  "Reinterpet_cast, UB and a Pointer Type Casting in C++17"
date:   2024-08-17 14:02:08 +0300
categories: c++
tags: c++17 reinterpet_cast std::launder ub ubsan
published: true
---
Let's have a closer look at `reinterpet_cast<>()` expression in C++ and find out why it's a frequent source of a dangerous thing called undefined behavior (UB). Then while skimming through wonders and reliability of UB Sanitizer `-fsanitize=undefined`, we'll design a UB-free solution on how to deal with an object when all you have is its byte representation (aka `char*` pointer to it) .

## Motivation 

For this article I got motivated by two things:

First, someone who titled themselves as "C++ guru" and in the past had delivered at least one very good talk on C++, ~recently-ish made a video about `reinterpet_cast`, where they claimed two major things: `reinterpet_cast` is often misused which causes an UB in a program (I fully agree with that), and  they offered a "solution", which...contained the very same UB, they warned against. Worse than that, they used a UB sanitizer to prove their point.

Second, during code reviews I see that `reinterpet_cast` leads to an UB on basically every occasion.

So, it turns out that many people, including quite skilled ones, are making mistakes with pointer conversions and `reinterpet_cast` expression in C++, and are prone to false beliefs about reliability and powers of the toolset they use. These topics aren't very complicated, though, but they require some clear understanding, so I wanted to give a new perspective for those who weren't bothered for the time being.

### Scope of the Article

By default we'll talk about C\++17 here, so for reference I'll post links to [the latest publicly available C++17 Standard draft (n4659)](https://timsong-cpp.github.io/cppwp/n4659). Newer language versions have some additional useful tools, but that's a different story that will not be touched here. What's important is that a correct solution in C++17 stays correct everywhere else and that all considerations below are mostly (maybe even fully) applicable to other language versions too, unless otherwise is specifically mentioned.

Another thing to highlight: we're talking about passing objects of [trivially copyable types](https://timsong-cpp.github.io/cppwp/n4659/basic.types#9) here. In the simplest terms, these are scalar types and pure C-style structures composed of such types or other such structures. More complex types require more considerations that are way out of the scope of the article, but just note that probably the safest way to solve that is to pass around a serialized object representation, which is trivially copyable by definition.

## What's the Fuzz with reinterpet_cast?

In the essence, `reinterpet_cast` converts between various pointer types and/or some non-pointer integral types large enough to hold a pointer (such as `std::uintptr_t` and alike). The basics of it is very simple: any object pointer type `T1*` could be [converted](https://timsong-cpp.github.io/cppwp/n4659/expr.reinterpret.cast#7) to any other object pointer type `cv T2*`, even very "unrelated" ones.

Problems start when a pointer to an incompatible type is dereferenced to access the underlying object stored under the pointer as if it's of a compatible type. [Dereferencing an incompatible pointer is an undefined behaviour (UB)][sa-rule], which means a compiler is not bound by any requirements of the Standard and is free to produce any result.

Here's an example (everywhere below `int` or `unsigned` are assumed to have the same size as `float`):

```c++
float f{1.f};
unsigned* p{ reinterpet_cast<unsigned*>(&f) };// (1) OK, conversion between
                                              // pointers to objects are allowed
unsigned u{*p};  // (2) UB. The object under the `p` pointer is still a `float`.
                 // It shouldn't be accessed through a pointer to `unsigned`
```

### A Fix That isn't a Fix

The person I mentioned in the motivation section above claimed that `reinterpet_cast` has some "special mode activated through an `unsigned char*`" and offered to change the initialization expression in statement (1) to this: `reinterpet_cast<unsigned*>(reinterpet_cast<unsigned char*>(&f))` to activate the mode and prevent the UB in the pointer use later.

The problem is...there's just [no such "mode"][reint-page]. The claim might be based on misunderstanding of so called "strict aliasing rule", that permits an object byte representation inspection/modification though [a few special types only](https://timsong-cpp.github.io/cppwp/n4659/basic.lval#8.8). So one can indeed read/modify a byte in a memory representation of a `float`: this operation is perfectly well-defined. But one should not read/modify an `unsigned` object that is obtained from a pointer to a byte being a part of a float object. Despite the change, the UB in the statement (2) doesn't go away, since `reinterpet_cast` does nothing to objects towards which the pointers point to.

### UB Sanitizer Argument Fallacy

Funnily enough, when I pointed that out, they responded with a link to a godbolt snippet that contained a sample code which was compiled with UB sanitizer `-fsanitize=undefined` enabled. UBSan didn't produce any warnings, so the person concluded that their code is fine. For some reason, though, they had failed to notice, that UBSan didn't produce warnings in the original code (without a roundtrip through `unsigned char*`) also! But we'll touch on the UBSan later.

## Basic Principles of C++ Needed to Untangle reinterpet_cast Misuse

To understand the problem better, let's recall a few basic principles of C++ that are basically the same in all versions of the Standard:
- **everything**, [except](https://timsong-cpp.github.io/cppwp/n4659/basic.types#8) for functions and references, in C++ **are [objects](https://timsong-cpp.github.io/cppwp/n4659/intro.object)** (even an `int`, a `float`, any pointer, even the simplest `char` are such objects).
- **each object has a lifetime**, and the object is what it is [only during that time period](https://timsong-cpp.github.io/cppwp/n4659/basic.life#4). Outside of an object's lifetime, basically only memory inspection operations (accesses through `char`, `unsigned char` or `std::byte`) are well-defined and it is so [only when they are done right](https://timsong-cpp.github.io/cppwp/n4659/basic.life#6).
- there are **[strict rules][sa-rule]**, which govern **how an object could be accessed** (read/modified) within its lifetime. cppreference.com have a somewhat simpler, though less precise, [version of that](https://en.cppreference.com/w/cpp/language/reinterpret_cast#Type_accessibility)

### A Better Mind Model of reinterpret_cast

These principles alone could yield a better understanding and a mind model of what `reinterpet_cast` is doing once we notice that its [specification][reint-page] only talks about pointers or related integral types, but puts no restrictions on objects to which the pointers point to. It doesn't even mention these objects! Why? Well, such is the design of the tool, and how an object should be accessed is already described in the [different section][sa-rule] mentioned above.

So, `reinterpet_cast` allows to freely convert between pointers or related integral types, without any regard to objects towards which these pointers point to. This tool makes a developer responsible for its proper and safe use. With it one could create, for example, not just a pointer to 64 bit `std::int64_t` from a pointer to 16 bit `std::uint16_t` object, but a pointer to `std::list<std::vector<std::int64_t>>` or anything else more complicated out of a pointer to a `float` (or any other pointer) - these would be perfectly fine pointer objects, with a single caveat: dereferencing them will cause an UB.

Then why one thinks that `*reinterpet_cast<unsigned*>(&float_obj)` is magically fine, even though there's no object of an `unsigned` type within its lifetime underneath, while `*reinterpet_cast<std::list<std::vector<std::int64_t>>*>(&float_obj)` definitely isn't?

## Dangers of an Undefined Behavior

There is a common argument that I hear: "Yeah, yeah, I get it, but `reinterpet_cast` is misused so often, that compiler writers would not dare to break what an average programmer expects from it". Maybe, but maybe not. I personally find this argument to be quite weak, since we already have a nice example of the contrary: [https://kqueue.org/blog/2012/06/25/more-randomness-or-less/](https://kqueue.org/blog/2012/06/25/more-randomness-or-less/). In short, some security critical code in OpenSSL contained an UB, - a read from an uninitialized variable was used to generate more random seed for a random number generator (RNG). The buggy code worked perfectly fine for a decade, until some day it stopped. A new compiler just silently wiped away the whole chain of computations that had gathered randomness from different sources! This led to a fixed seed and consequently a predictable output from the RNG, which is a major security issue.

For me this example is a sufficient proof by converse, that one shall not rely on UB in their code. Even when that UB has worked consistently for a decade. This is especially true, when you can eliminate the issue entirely simply by doing things in a right and safe way.

## Pointer Type Casting in C++17

Ok, then when a code takes some byte representation of a trivially copyable object (or an array of such objects) as `unsigned char* data` pointer, what would be a safe and proper way to deal with it? How to "cast it back" to the proper object type?

Given the basic principles, reminded above, to convert `unsigned char* data` to a usable pointer to the underlying object we need to tell a compiler just two things:

- (a) that the object under `unsigned char* data` pointer is actually of a different type (let's call this type `A`), and
- (b) that the underlying object of type `A` to the first byte of which refers the `data` pointer, is within its lifetime, so its use shouldn't be optimized away.

NOTE: notice how the lifetime consideration (b) make the problem appear more similar to the problem in OpenSSL's security-related code, showcased above!

Solution to both (a) and (b) parts depend on our knowledge of how the object under the `data` was created in the first place.

There are two possibilities:

- (1) we know for sure that the object under the `data` was initially created exactly as the object of type `A`. For example, we control a code that invokes some external functionality and a callback, that receives an arbitrary context structure passed as binary `unsigned char*` or similar blob. That way, in the callback, we know how the object under the context pointer was created in the first place.
- (2) when we don't know how the underlying object was created. This is the case of, for example, a network callback or a deserialization code. In the essence it is when the only thing you know for sure is that you've got some bytes matching memory representation of the type you need.

### Case (1): the Object Under `data` Was Created As the Object of Type `A`

Solution for the case (1) in C\++17 is two-step simple: first `reinterpet_cast<A*>(data)` produces a pointer object that points to an object of type `A`, then wrapping it in [std::launder()](https://timsong-cpp.github.io/cppwp/n4659/ptr.launder):

```c++
A* ptr{ std::launder(reinterpet_cast<A*>(data)) };
```

informs a compiler that the object under the pointer obtained from `reinterpet_cast` is within its lifetime (now it's a good time to give credits to someone with a nick "**LegionMammal978**" in Cpplang slack community, who have helped me to notice the use-case for `std::launder` here).

### A Tiny Demo of UB Effects or How Much Should You Trust to a UB Sanitizer

Now it's a time for another side note before solving the case (2): while preparing this post and experimenting with godbolt, with a help of `std::launder` I've managed to create a nice demonstration of UB effects with this tiny simple code [https://godbolt.org/z/sY45KfKKa](https://godbolt.org/z/sY45KfKKa):

```c++
int danger(float* f, int* i) {
    *i = 1;
    *std::launder<float>(f) = 0.f;
    return *i;
}

int main() {
    int i{5};
    int j{danger(reinterpret_cast<float*>(&i), &i)};
    std::printf("%d %d\n", i, j);
}
```

Observe that:
- MSVC produces `0 0`
- Clang (I tried v10.0.1 and v18.1.0)
  - without UBSan produces `0 1`, and
  - with `-fsanitize=undefined` produces `0 0`
- GCC (starting with v13.1 and newer)
  - without UBSan produces `1 1`, and
  - with `-fsanitize=undefined` produces `0 1`

Isn't it neat?

And though as a user, I'd prefer a compiler to be at least consistent in UB effects it produces, I'm not even sure I should file bug reports for this snippet. There are 2 UBs there and even a perfectly Standard conforming compiler is under no obligation to produce anything meaningful at all.

Notice that neither clang nor gcc's UBSan see any issues with the code! How sound is the "UBSan proves there are no UBs in my code!" argument now?

This example also highlights the importance of employing multiple compilers for testing code, as with a decent test coverage, it makes it easier to detect UBs.

Now back to solving the case (2).

### Case (2): `data` Points to Bytes Matching Memory Representation of the Type `A`

Since we're dealing with a trivially copyable type `A`, it's time to recall that these types have several very important properties, directly specified in the Standard:

- objects of these types occupy [contiguous bytes of storage](https://timsong-cpp.github.io/cppwp/n4659/intro.object#7), hence its byte representation is guaranteed to be local and contiguous, and
- by copying a byte representation of one object into a byte representation of the other object of the same type, one could [fully reconstruct the original source object](https://timsong-cpp.github.io/cppwp/n4659/basic.types#3).

Coupled with basic principles from above this allows to craft the following small helper function template to solve case (2). It casts `unsigned char* data` to a pointer to another object while taking care of object's lifetime and alignment requirements:

```c++
// representation type, one of permitted by strict aliasing rule
// https://timsong-cpp.github.io/cppwp/n4659/basic.lval#8.8
using Repr_t = unsigned char;

template <typename T>
T* makeSafePtr(Repr_t* const data, const std::size_t size) {
    // ensure type T is compatible with the algo
    static_assert(std::is_trivially_copyable_v<T>);

    // verify buffer size
    if (size == 0 || size % sizeof(T) != 0) {
        std::abort();  // you might want to throw instead.
    }

    // verify the pointer is properly aligned to contain T underneath
    if (reinterpret_cast<std::uintptr_t>(data) % alignof(T) != 0) {
        std::abort();  // you might want to throw instead.
    }

    Repr_t buf[sizeof(T)];  // just a byte array, a temporary storage to
    // backup the original mem representation, since it can be distorted later
    std::memcpy(&buf[0], data, sizeof(T));

    // starting lifetime of T inside the data and perform non-vacuous
    // initialization https://timsong-cpp.github.io/cppwp/n4659/basic.life#1.2
    // that could change the underlying memory. Previous content is implicitly
    // destroyed https://timsong-cpp.github.io/cppwp/n4659/basic.life#5
    // Starting lifetime of T is mandatory because
    // https://timsong-cpp.github.io/cppwp/n4659/basic.life#4
    T* ptr = new (data) T;

    // replacing byte representation
    std::memcpy(ptr, &buf[0], sizeof(T));

    // now *ptr is created in data memory buffer, it has its lifetime started
    // and it has a proper byte representation.
    // Since T is trivially copyable, it also has a trivial destructor, so
    // there's no special need to call a destructor to end its lifetime.
    return ptr;
}
```

Now, one can obtain a usable pointer to `A` with just `makeSafePtr<A>(data)` call.

See the demo here [https://godbolt.org/z/e8j4TcKP6](https://godbolt.org/z/e8j4TcKP6)

Notice that each of 3 major compilers have generated a pretty efficient code and that clang and gcc are the ancient ones, available in old Ubuntu.focal out of the box. There are just no temporary buffers, `memcpy()` calls and whatnot in the assembly. Each compiler was able to infer that the only side effect of the function (not counting buffer size and pointer alignment checks) is a pointer cast from `unsigned char*` to a `A*` that points to an existing object of A within its lifetime.

## Acknowledgements

In addition to already mentioned Cpplang slack community member "**LegionMammal978**", discussion with whom was helpful for me, a huge personal thanks goes to **Richard Smith**, who posted this eye opening message with some valuable info on compiler's internals: [https://web.archive.org/web/20201128194944/http://www.open-std.org/pipermail/ub/2016-February/000565.html](https://web.archive.org/web/20201128194944/http://www.open-std.org/pipermail/ub/2016-February/000565.html) and to a kind and careful soul, who shared that link on [reinterpret_cast page](https://en.cppreference.com/w/cpp/language/reinterpret_cast) of cppreference.com. 

[reint-page]: https://timsong-cpp.github.io/cppwp/n4659/expr.reinterpret.cast
[sa-rule]: https://timsong-cpp.github.io/cppwp/n4659/basic.lval#8
