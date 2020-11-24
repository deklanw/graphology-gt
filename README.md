.gt file parser for graphology.

gt stands for "graph-tool" as in the [Python network library](https://graph-tool.skewed.de/)

[The format compresses well and has fast decompression.](https://graph-tool.skewed.de/static/doc/gt_format.html)

You can find zstd-compressed gt networks of various kinds to play with [here](https://networks.skewed.de/).

Can be used with Node or from the browser using the [buffer package](https://github.com/feross/buffer).

### Limitations

- Doesn't support true 64 bit (u)ints (casts to Number). Could change to work with BigInts
- Doesn't support long doubles (no way to parse with the Buffer module currently?)
