---
layout: post
title:  "Reflections on completing Google Foobar Challenge"
date:   2023-09-30 21:00:00 +0300
categories: general
tags: algorithms
published: true
---

I've recently completed all 5 levels of a Google Foobar Coding Challenge and would like to share a few reflections on that.

- Years ago I heard that Google has that funny thing, but didn't even know how it is called and thought that I'm not eligible to it, because I didn't google for advanced enough concepts :rofl: Can't be further from the truth with it, as you can see from the screenshot, about the reverse is true.

![Google Foobar Challenge hook](/img/RAII_google_foobar.jpg)

- All tasks of the challenge are about building algorithms based on understanding how things works (or could/should work) and you are given a very decent amount of time to think on them and to solve them without a hurry even when you have a family to care about after a full time job.

- Even though many tasks were concerned of mostly mathematical problems, no special knowledge of math beyond "a few grades of a rural church school" (c) were actually needed. Provided that you had really studied. Otherwise you'll be frustrated like one commenter I saw elsewhere, who asserted (and was approved by others) something like: "Google wants to hire mathematicians with that challenge, not programmers!". The only possible exception from this could be the last task, which I was unable to solve by myself without googling a few details, but even then, after learning about one math concept that was totally new to me, it was pretty easy to tackle. Though, I can't exclude a possibility that I didn't find another solution that didn't require that special math concept - would be very interesting to learn about it.

- Interestingly, at least one task was graded quite liberally. It had three solutions: naive O(N^3) didn't pass a performance test. O(N^2) was passing some time ago, according to the very same thread that had an above-mentioned "hire mathematicians" comment. I solved it in O(N), which have obviously also passed. Something like this is likely true about other tasks too.

- This doesn't mean, that the tasks were trivial! On the contrary, only the first two out of all 9 in total were kinda almost obvious. All the rest required some thinking and several calm & quiet pen and paper sessions. This was actually the most enjoyable part!

- As it almost universally happens, - the most difficult part was to understand a problem conditions correctly :grin:. Some, btw, were phrased in quite an adversarial way, some were (imo) missing a few important details. Probably the weirdest thing authors of the Challenge have implemented is that they have correctness tests and performance tests, but you never know what is failing precisely, because it's just a "test case N". Never in my life I have encountered a situation where it was impossible to triage why a system is misbehaving, - is it due to a bug, or is it because the implementation of something isn't fast enough. Ah, an on top that, solutions had to use an ancient Python 2.7, which I've never touched in my life. So this wasn't trivial and mostly fun.


Highly recommend on an occasion!)

## Comments

Please share your thoughts and feedback on the article [here](https://www.linkedin.com/posts/activity-7112123630104276992-mYCQ?utm_source=myblog&utm_medium=member_desktop)
