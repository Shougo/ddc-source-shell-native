# ddc-source-shell-native

Shell native completion for ddc.vim

## Required

### denops.vim

https://github.com/vim-denops/denops.vim

### ddc.vim

https://github.com/Shougo/ddc.vim

### shell

One of the followings

- fish
- xonsh
- zsh and zsh/zpty module

## Configuration

```vim
call ddc#custom#patch_global('sources', ['shell-native'])
call ddc#custom#patch_global('sourceOptions', #{
      \   shell-native: #{ mark: 'fish' },
      \ })
call ddc#custom#patch_global('sourceParams', #{
      \   shell-native: #{ shell: 'fish' },
      \ })
```

## Original code

It includes
[zsh-capture-completion](https://github.com/Valodim/zsh-capture-completion) and
[deoplete-zsh](https://github.com/deoplete-plugins/deoplete-zsh)
