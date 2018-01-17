---
layout: post
title: File I/O Inside Intel SGX Enclave
---

Update (Jan 15, 2017): Intel SGX SDK now has built-in support for secure file 
I/O. See my blog post [Understanding SGX Protected File System]({{ site.baseurl 
}}2017/01/15/understanding-sgx-protected-file-system/) for more.

Intel Software Guard Extensions (SGX) is a set of new x86 instructions that 
enable a new kind of programming primitive called enclave to be created, 
launched, attested, sealed and destroyed. Enclave is a protected area of the 
address space of a process, in which the code and data cannot be snooped or 
tampered by any software or hardware measures that are originated from outside 
the enclave. Enclave can be very useful for building secure cloud apps that 
are protected from potentially malicious cloud providers. 
See [white papers](https://software.intel.com/sites/default/files/managed/d5/e7/Intel-SGX-SDK-Users-Guide-for-Windows-OS.pdf)
and [technical slides](https://software.intel.com/sites/default/files/332680-001.pdf) 
for more information about Intel SGX.

While all the code and data inside enclave are protected, not all code can be
executed inside an enclave, for example, all privilleged instructions are 
invalid in enclave. This means all system calls and I/O operations are 
not available in enclave. Thus, it would not be surprising that the 
standard C library shipped with SGX SDK is intetionally left incomplete, 
missing lots of common and useful procedures, e.g. `open`, `read`, `write`, 
`close`, `exit`, etc. This makes porting existing applications into enclave 
a painful job.

Here is a full list of invalid instructions inside enclave:

| Types | Instructions |
| --- | --- |
| VMEXIT generating instructions are not allowed because a VMM cannot update the enclave. Generates a #UD. | `CPUID`, `GETSEC`, `RDPMC`, `RDTSC`, `RDTSCP`, `SGDT`, `SIDT`, `SLDT`, `STR`, `VMCALL`, `VMFUNC` |
| I/O instructions (also VMEXIT). Generates #UD. | `IN`, `INS/INSB/INSW/INSD`, `OUT`, `OUTS/OUTSB/OUTSW/OUTSD` |
| Instructions which access segment registers will also generate #UD. | Far `CALL`, Far `JMP`, Far `RET`, `INT n`/`INTO`, `IRET`, `LDS/LES/LFS/LGS/LSS`, `MOV` to `DS/ES/SS/FS/GS`, `POP DS/ES/SS/FS/GS`, `SYSCALL`, `SYSENTER` |
|Instructions that try to reenter the enclave. Gen- erates #GP. | `ENCLU[EENTER]`, `ENCLU [ERESUME]` |

In this post, I will talk about how to work around this limitation of enclave 
programming *gracefully*. In particular, I choose file I/O inside enclave as an 
illustrating example.

## OCalls

There are two important types of function calls that are relevant to SGX--- 
*ECalls* and *OCalls*. An ECall is a (trusted) function call that enters an 
enclave; while an OCall is a(n) (untrusted) function calls that leaves an 
enclave. In order to perform privileged or I/O operations in an enclave, what 
we are gonna do is essentially making OCalls. Initiated from within enclave 
yet executed outside enclave, OCalls can be implemented using any CPU 
instructions, and are available for enclaves. Thus, OCalls provide access 
points that enable us to use operating system capabilities outside the 
enclave such as system calls, I/O operations, and so on.

OCalls (as well as ECalls) are defined in a special syntax called **Enclave 
Definition Language (EDL)**. The code below shows what an EDL file looks like:

{% highlight cpp %}
enclave {
     /* ECall functions, trusted functions that will be executed inside enclave */
     trusted {
          int sample_ecall(int len, [out, size=len] void* buf);
     };
     /* OCall functions, untrusted functions that will be executed outside enclave */
     untrusted {
          int sample_ocall(int len, [in, size=len] char* str);
     };
};
{% endhighlight %}

Note that evoking an OCall would trigger the CPU to switch between enclave 
mode and user mode, which comes with certain overhead. Moreover, OCalls can 
make the calling enclave vunerable to various attacks. Therefore, from either 
a performance or security perspective, OCall should be used with caution.

Next, I will show how to write user-friendly wrapper functions for OCalls. 
Take I/O operations as an example.

## Library Patching: An example

Say you are going to port something like below into enclave:

{% highlight cpp %}
#include <stdio.h>

int log_lvl = 4;
#define log(level, msg) {                       \
    if (level < log_lvl) fprintf(stderr, msg);  \
} /* compiler error! */
{% endhighlight %}

The problem is that `stdio.h` shipped with SGX SDK has neither `stderr` nor 
`fprintf`. Apparently, comment out every occurences of log is not ideal. 
Not only it’s tedious and error-prone, more importantly, it deprives you of 
the ability of logging, which is critical for debug purpose. In contrast, 
my proposed solution is quite simple and elegant, keeping your logging code 
yet requiring only one-line modification (for each file):

{% highlight cpp %}
#include “stdio.h” /* use a patched header file! */

int log_lvl = 4;
#define log(level, msg) {                       \
    if (level < log_lvl) fprintf(stderr, msg);  \
} /* compiler ok! */
{% endhighlight %}

The idea is simple: we write a patched version of c library header, which 
includes the stuff that is missing. I call this technique *library patching*. 
The code below is our new `stdio.h`:

{% highlight cpp %}
/* stdio.h */
#ifndef __STDIO_H
#define __STDIO_H

#include <stdio.h>

#ifndef _INC_FCNTL
#define _INC_FCNTL

#define O_RDONLY       0x0000  /* open for reading only */
#define O_WRONLY       0x0001  /* open for writing only */
#define O_RDWR         0x0002  /* open for reading and writing */
#define O_APPEND       0x0008  /* writes done at eof */

#define O_CREAT        0x0100  /* create and open file */
#define O_TRUNC        0x0200  /* open and truncate */
#define O_EXCL         0x0400  /* open only if file doesn't already exist */

#define O_TEXT         0x4000  /* file mode is text (translated) */
#define O_BINARY       0x8000  /* file mode is binary (untranslated) */
#define O_WTEXT        0x10000 /* file mode is UTF16 (translated) */
#define O_U16TEXT      0x20000 /* file mode is UTF16 no BOM (translated) */
#define O_U8TEXT       0x40000 /* file mode is UTF8  no BOM (translated) */

#endif

#ifdef __cplusplus
extern "C" {
#endif

extern int stdin, stdout, stderr;

int open(const char* filename, int mode);
int read(int file, void *buf, unsigned int size);
int write(int file, void *buf, unsigned int size);
void close(int file);

void fprintf(int file, const char* format, ...);

#ifdef __cplusplus
}
#endif

#endif
{% endhighlight %}

OCalls are our secret sauce of implementing the new `stdio`:

{% highlight cpp %}
/* stdio.cpp */
#include "stdio.h"
#include <stdarg.h>
#include <string.h>
#include “SampleEnclave_t.h"

int stdin = 0, stdout = 1, stderr = 2;

void fprintf(int file, const char* fmt, ...) {
#define BUF_SIZE 1024
    char buf[BUFSIZ] = {'\0'};
    va_list ap;
    va_start(ap, fmt);
    vsnprintf(buf, BUFSIZ, fmt, ap);
    va_end(ap);
    size_t len = strlen(buf);
    write(file, buf, len);
}

int open(const char* filename, int mode) {
    int ret;
    if (ocall_open(&ret, filename, mode) != SGX_SUCCESS) return -1;
    return ret;
}

int read(int file, void *buf, unsigned int size) {
    int ret;
    if (ocall_read(&ret, file, buf, size) != SGX_SUCCESS) return -1;
    return ret;
}

int write(int file, void *buf, unsigned int size) {
    int ret;
    if (ocall_write(&ret, file, buf, size) != SGX_SUCCESS) return -1;
    return ret;
}

void close(int file) {
    ocall_close(file);
}
{% endhighlight %}

Since OCalls are special functions that cause CPU switch between enclave mode 
and user mode (so do ECalls), they have to be defined in the project’s EDL file:

{% highlight cpp %}
/* SampleEnclave.edl */
enclave {
    trusted {
        // ...
    };

    untrusted {
        int ocall_open([in, string] const char* filename, int mode);
        int ocall_read(int file, [out, size=size] void *buf, unsigned int size);
        int ocall_write(int file, [in, size=size] void *buf, unsigned int size);
        void ocall_close(int file);
    };
};
{% endhighlight %}

All the code above are part of the enclave project. In the other project that 
imports and uses the enclave,  we must give the implementation of the OCalls:

{% highlight cpp %}
/* ocall.cpp
 * Assuming the code is compiled under windows
 */
#include "io.h"

int ocall_open(const char* filename, int mode) {
    return _open(filename, mode);
}

int ocall_read(int file, void *buf, unsigned int size) {
    return _read(file, buf, size);
}

int ocall_write(int file, void *buf, unsigned int size) {
    return _write(file, buf, size);
}

void ocall_close(int file) {
    _close(file);
}
{% endhighlight %}

That’s it! Congratulations. Now, following this pattern, you can add any missing 
functionality to the incomplete C standard library of Intel SGX.
