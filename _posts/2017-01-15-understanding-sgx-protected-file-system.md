---
layout: post
title: Understanding SGX Protected File System
---

This blog post is for whose who are curious about the internals of Intel SGX SDK and
interesting about applied cryptography.

## Overview of SGX Protected File System

With the release of [Intel SGX SDK](https://github.com/01org/linux-sgx) v1.9,
one important missing functionality of Intel SGX SDK is finally there:
*secure file I/O*. It is provided in a component of Intel SGX SDK, named
[Intel Protected File System Library](https://software.intel.com/en-us/node/738203), 
which enables developers to perform I/O operations inside enclaves securely.
More specifically, it guarantees

+ *Confidentiality of user data*: All user data is encrypted and then written
to disk to prevent any data leakage;
+ *Integrity of user data*: All user
data are read from disk and then decrypted with MAC (Message Authentication
Code) verified to detect any data tampering;
+ *Matching of file name*: When opening an existing file, the metadata of the
to-be-openned file will be checked to ensure that the name of the file when
created is the same as the name given to the open operation.

There is a dozen of APIs provided by SGX Protected File System:

{% highlight c %}

/* File: sgx_tprotected_fs.h */

SGX_FILE* SGXAPI sgx_fopen(const char* filename, const char* mode, sgx_key_128bit_t *key);
size_t SGXAPI sgx_fwrite(const void* ptr, size_t size, size_t count, SGX_FILE* stream);
size_t SGXAPI sgx_fread(void* ptr, size_t size, size_t count, SGX_FILE* stream);
int64_t SGXAPI sgx_ftell(SGX_FILE* stream);
int32_t SGXAPI sgx_fseek(SGX_FILE* stream, int64_t offset, int origin);
int32_t SGXAPI sgx_fflush(SGX_FILE* stream);
int32_t SGXAPI sgx_feof(SGX_FILE* stream);
int32_t SGXAPI sgx_fclose(SGX_FILE* stream);
int32_t SGXAPI sgx_remove(const char* filename);

SGX_FILE* SGXAPI sgx_fopen_auto_key(const char* filename, const char* mode);
int32_t SGXAPI sgx_fexport_auto_key(const char* filename, sgx_key_128bit_t *key);
int32_t SGXAPI sgx_fimport_auto_key(const char* filename, sgx_key_128bit_t *key);

int32_t SGXAPI sgx_ferror(SGX_FILE* stream);
void SGXAPI sgx_clearerr(SGX_FILE* stream);

int32_t SGXAPI sgx_fclear_cache(SGX_FILE* stream);

{% endhighlight %}

The APIs should look quite familiar, even to entry-level C programmers, as most
of these APIs have the same semantics as their counterparts in C standard
library. The APIs with suffix `_auto_key` are related to using and managing
automatic keys, which free the users from specifying a key explicitly.
Automatic keys are derived from the enclave sealing key. Please see [Intel
documents](https://software.intel.com/en-us/node/738203) for more information. 

The rest of this blog post is dedicated to explaining how SGX Protected File
System works behind the scene.

## A Variant of Merkle Hash Tree

In SGX Protected File System, a variant of Merkle Hash Tree is used to protect
both confidentiality and integrity of data.

A *Merkle Hash Tree (MHT)*, as [defined in
Wikipedia](https://en.wikipedia.org/wiki/Merkle_tree), is "a tree in which
every leaf node is labelled with the hash of a data block and every non-leaf
node is labelled with the cryptographic hash of the labels of its child nodes”.
The core idea of MHT is that by organising the hash values in a tree, the
integrity of a data block can be checked in a complexity of log(N), where N is
the number of nodes in the tree.The figure below shows a classic MHT that 
consists of 7 MHT nodes that covers 4 data blocks.
![A classic MHT that consists of 7 MHT nodes that covers 4 data blocks.]({{ 
site.baseurl }}public/img/sgx-protected-file-system/MHT-classic.png "A classic 
MHT that consists of 7 MHT nodes that covers 4 data blocks.")

While the idea of MHT is simple enough, there are other considerations when
implementing a MHT-like cryptographic construct for SGX Protected File System.
First, the integrity protection provided by MHT must be combined with the
confidentiality protection provided by some encryption scheme in an efficient
way. Second, user data as well as the associated cryptographic materials (e.g.,
keys and MACs) should be organised in blocks (usually 4KB), which is the
granularity of data management in file systems.

For the above reasons, SGX Protected File Systems implements a variant of MHT
(see the figure below) with the following characteristics:

+ *Authenticated encryption*. To protect both confidentiality and integrity,
it is more efficient to use authenticated encryption—a form of encryption which
simultaneously provides confidentiality, integrity—rather than doing encryption
and MAC separately. [AES-GCM
scheme](https://en.wikipedia.org/wiki/Galois/Counter_Mode), widely accepted for
its high throughput, is used in the implementation of SGX Protected File
System.
+ *Block-size nodes*. The tree consists of nodes whose sizes are all equal to
the size of a block on disk (4KB). Every node is encrypted before writing to
disk and decrypted after reading from disk. There are three different types of
node:
  1. *The metadata node* maintains the file name as well as the encryption
key and MAC of the root MHT node (H<sub>0</sub>). In addition, to reduce the
disk space consumption for small files, the metadata node also contains the
first 3KB of user data.
  2. *A MHT node* stores the encryption keys and MACs
of its child nodes.
  3. *A data node* stores one block of user data.
+ *Easy-to-append layout*. In a classic MHT, data nodes are only linked to
leaf MHT nodes; yet, in this variant of MHT, data nodes are linked to leaf MHT
nodes as well as non-leaf MHT nodes. This makes changes to the tree trivial
when appending new data to the end of file. Another benefit is that the on-disk
offsets of nodes can be determined easily.

![The MHT variant used in SGX Protected File System. For the sake of brevity, this figure only shows, for each MHT node, two data nodes and two MHT nodes as children. In the actual implementation, each MHT node can has up to 96 data nodes and 32 MHT nodes as children.]({{ site.baseurl }}public/img/sgx-protected-file-system/MHT-variant.png "The MHT variant used in SGX Protected File System. For the sake of brevity, this figure only shows, for each MHT node, two data nodes and two MHT nodes as children. In the actual implementation, each MHT node can has up to 96 data nodes and 32 MHT nodes as children.")

## I/O Operations with a LRU Cache

Now that we understand the in-memory data structure and on-disk data layout of
the MHT variant used in SGX Protected File System, let’s examine the I/O
operations.

Reads and writes on a SGX-protected file (see the pseudocode below) are broken
down into multiple memory copies from or to the plaintext buffers of node
objects, which are acquired from a LRU (Least Recently Used) cache maintained
for the SGX-protected file. Thanks to this cache, the implementation does not
need to perform log(N) disk reads/writes for each and every read/write
operations, where N is the number of nodes in the tree.

```
Read(pf, buf, size): % called by sgx_fread()
    % pf - SGX protected file
    % buf - output buffer for read
    % size - maximum number of bytes to read
    Lock pf.mutex
    begin <— pf.cursor
    end <- Min(pf.cursor + size, pf.size)
    for i in { The IDs of data nodes that cover the range [begin, end) }:
        N_i <— GetNodeFromCache(pf, i)
        Copy data from N_i.plaintext to buf
        EvictNodesFromCache(pf)
    Update pf.cursor
    Unlock pf.mutex

Write(pf, buf, size): % called by sgx_fwrite()
    % pf - SGX protected file
    % buf - output buffer for write
    % size - maximum number of bytes to write
    Lock pf.mutex
    begin <— pf.cursor
    end <- pf.cursor + size
    for i in { The IDs of data nodes that cover range [begin, end) }:
        N_i <— GetNodeFromCache(pf, i)
        Copy data from buf to N_i.plaintext
        for j in { The IDs of N_i and all its ancestor nodes }:
            A <- GetNodeFromCache(pf, j)
            A.dirty <- True
        EvictNodesFromCache(pf)
    Update pf.cursor
    Unlock pf.mutex
```

To acquire a node object from the cache, we first check whether the node
already exists in the cache. If so, then we are done; otherwise, we have to
read the data of the requested node from the disk (via OCall) or simply
initialise an all-zero buffer depending upon whether the node has been written
to disk before. In addition, we have to recursively acquire the parent of the
requested node from the cache.

```
GetNodeFromCache(pf, i):
    % pf - SGX protected file
    % i - the ID of node (e.g., the ID of metadata node is 0, root MHT node is 1, first data node is 2, etc. )
    if key i is in pf.cache:
        N_i <— get the node object with key i from pf.cache
        return N_i

    N_i <- Allocate and initialize an object of Node
    P <- GetNodeFromCache(f, N_i.parent_id)
    if N_i does not exist on disk:
        N_i.new <— True
        fill Ni.plaintext with 0’s
    else:
        N_i.new <— False
        OCallReadNode(pf.file, i, &N_i.ciphertext)
        N_i.plaintext <— Decrypt and validate N_i.ciphertext by the key and MAC provided by Parent P
    Add key-value pair (i, N_i) to f.cache
    return N_i
```

Nodes get evicted from the cache only when the cache reaches a high-water mark.
If the to-be-evicted nodes are *dirty* (i.e., they have been modified after
loaded into cache), then their data must be flushed to disk.

```
EvictNodesFromCache(pf):
    while pf.cache.size > some predefined threshold:
        E <— Get the least recently used node from pf.cache
        if E.dirty is True:
            FlushData(pf)
        Remove E from the cache
        Free object E in memory
```

When flushing the data of a dirty node to disk, we re-encrypt the data of the
node and calculate its MAC with this new key. Then, the new key and MAC of the
node is recorded in its parent, which will be flushed to disk later. This is
why these dirty nodes are sorted before the flush actually begins. This way, we
ensure that that all modified user data and their associated keys and MACs are
re-encrypted and written back to disk.

What happens if the program crashes in the middle of flushing? The data on disk
must be left inconsistent, causing integrity check failure when the file is
opened next time. To resolve this issue, before committing any modification to
disk, the flush procedure creates a recovery file, which records the previous
version of all dirty nodes. This information is enough to restore the file back
to consistency if any crash occurs.

```
FlushData(pf):
    D <— { for all N_i in pf.cache where N_i.dirty = true or N_i.new = True }
    Sort the nodes in D so that each and every node is placed before its parent node

    recovery_file <— Open a temporary file
    for N_i in D:
        if N_i.new: continue
        WriteNode(recovery_file, i, N_i.ciphertext)

    Mark the beginning of this update
    for N_i in D:
        K <- Generate a random key
        N_i.cihpertext, M <— Encrypt N_i.plaintext and calculate its MAC with key K
        Save the key K and the MAC M in N_i.parent.plaintext
        OCallWriteNode(pf.file, i, N_i.ciphertext)
        N_i.dirty <— False
        N_i.new <— False
    Mark the end of this update

    Close and delete recovery_file
```

## Wrap Up

In this blog post, I give a brief introduction to SGX Protected File System and
then show in a high level how it works by describing its MHT-based data
structures and I/O operations with a LRU cache.

While it is important to know how SGX Protected File System work, it is as
important to know when it does NOT work. Here are the major limitations that
the users should be aware of:

+ *Limited concurrency*. At any time, only a single writer enclave or
multiple reader enclaves can open a SGX-protected file; that is, multiple
writer enclaves could corrupt a SGX-protected file when accessing the file
concurrently.
+ *Rollback attacks*. The users cannot detect whether he has opened an old
(but authenticated) version of a file. In other words, SGX Protected File
System does not guarantee the freshness of user data.
+ *Side-channel attacks*. Some seemingly-insignificant information, such as
file name, file size, access time, access pattern (e.g., which blocks are
read/written), etc, are not protected. This information could be used by
sophisticated attackers to gain sensitive information.

