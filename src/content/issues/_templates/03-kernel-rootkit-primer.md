---
title: "Linux Kernel Rootkit Primer"
author: "Marcus Webb"
handle: "ring0"
date: 2025-06-15
volume: 1
order: 3
category: guide
tags: [linux, kernel, rootkit, defense]
description: "Understanding kernel rootkits from a defensive perspective - how they work and how to detect them."
draft: true
---

# Linux Kernel Rootkit Primer

Understanding how rootkits work is essential for defending against them. This primer covers the fundamentals of Linux kernel rootkits from a **defensive perspective**.

> [!WARN] This material is for educational and defensive purposes only. Writing or deploying rootkits without authorization is illegal and unethical.

## What is a Kernel Rootkit?

A kernel rootkit is malicious code running in kernel space (ring 0) that modifies the operating system's behavior to hide an attacker's presence. Unlike userspace rootkits, kernel rootkits can:

* Hide processes, files, and network connections
* Intercept and modify system calls
* Log keystrokes at the kernel level
* Survive userspace security tools

## Loadable Kernel Modules

The most common attack vector for kernel rootkits is the Linux **Loadable Kernel Module (LKM)** system. Modules extend kernel functionality at runtime:

```c
#include <linux/module.h>
#include <linux/kernel.h>
#include <linux/init.h>

MODULE_LICENSE("GPL");

static int __init example_init(void) {
    printk(KERN_INFO "Module loaded\n");
    return 0;
}

static void __exit example_exit(void) {
    printk(KERN_INFO "Module unloaded\n");
}

module_init(example_init);
module_exit(example_exit);
```

```bash
# Build and load
make -C /lib/modules/$(uname -r)/build M=$(pwd) modules
sudo insmod example.ko
```

## System Call Table Hooking

The classic rootkit technique hooks entries in the system call table:

```c
// Conceptual example -- simplified for clarity
typedef asmlinkage long (*orig_getdents64_t)(
    unsigned int fd,
    struct linux_dirent64 *dirp,
    unsigned int count
);

orig_getdents64_t orig_getdents64;

asmlinkage long hooked_getdents64(
    unsigned int fd,
    struct linux_dirent64 *dirp,
    unsigned int count
) {
    long ret = orig_getdents64(fd, dirp, count);
    // Filter out entries matching hidden pattern
    // ... (removed -- defensive analysis only)
    return ret;
}
```

> [!HACK] Modern kernels protect the syscall table with write-protection. Rootkits disable this by modifying CR0 register's WP bit -- but this leaves detectable traces.

## Detection Techniques

### 1. System Call Table Integrity

Compare the current syscall table against known-good values:

```bash
# Check for syscall table modifications
cat /proc/kallsyms | grep sys_call_table
# Compare with a known-good baseline
```

### 2. Hidden Process Detection

Cross-reference `/proc` with kernel data structures:

```bash
# Compare process lists from different sources
ps aux | wc -l
ls /proc | grep -E '^[0-9]+$' | wc -l
# Discrepancies indicate hidden processes
```

### 3. Module Verification

```bash
# List loaded modules
lsmod

# Check for modules hidden from lsmod
cat /proc/modules
ls /sys/module/

# Compare counts -- hidden modules may appear
# in /proc but not lsmod
```

### 4. Memory Forensics

Tools like **Volatility** and **LiME** can capture and analyze kernel memory:

```bash
# Capture memory with LiME
sudo insmod lime.ko "path=/tmp/memory.lime format=lime"

# Analyze with Volatility
vol.py -f /tmp/memory.lime --profile=LinuxUbuntu2204 linux_check_syscall
vol.py -f /tmp/memory.lime --profile=LinuxUbuntu2204 linux_hidden_modules
```

## Kernel Hardening

Prevent rootkit installation with these defenses:

| Defense | Purpose |
|---------|---------|
| **Secure Boot** | Verify kernel integrity at boot |
| **Module Signing** | Only load signed kernel modules |
| **Lockdown LSM** | Restrict kernel modifications |
| **SELinux/AppArmor** | Mandatory access control |
| **KASLR** | Randomize kernel address space |
| **CONFIG_STATIC_USERMODEHELPER** | Restrict usermode helper |

```bash
# Check if module signing is enforced
cat /proc/sys/kernel/modules_disabled
# 1 = no new modules can be loaded

# Check lockdown mode
cat /sys/kernel/security/lockdown
```

## Further Reading

* "Linux Kernel Module Programming Guide" -- kernel.org
* "The Art of Memory Forensics" by Hale Ligh et al.
* Volatility Framework documentation
* "Detecting Hidden Kernel Modules" -- various academic papers

---

> [!INFO] The best defense against rootkits is prevention: keep systems patched, enforce secure boot, require signed modules, and monitor for anomalies.

*Know thy enemy, and know thyself.*
