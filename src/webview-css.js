"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function getStyles() {
    return `    :root,[data-theme="light"] {
      --bg: #ffffff;
      --bg-solid: #ffffff;
      --glass: transparent;
      --glass-strong: #f5f5f5;
      --card: transparent;
      --card-solid: #fafafa;
      --text: #111111;
      --text2: #333333;
      --text3: #666666;
      --blue: #0969da;
      --blue-hover: #0550ae;
      --green: #1a7f37;
      --red: #cf222e;
      --orange: #bf8700;
      --border: #d0d0d0;
      --r: 8px;
      --input-bg: #ffffff;
      --hover-bg: #f0f0f0;
      --code-bg: #f5f5f5;
      --shadow: rgba(0,0,0,0.08);
      --overlay-bg: rgba(0,0,0,.35);
      --help-bg: #ffffff;
      --accent-soft: rgba(9,105,218,0.06);
      --accent-gradient: linear-gradient(135deg,#0969da,#1a7f37);
      --user-msg-bg: #edf5ff;
      --glow: rgba(9,105,218,0.1);
    }
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{height:100%}
    body{
      font-family:-apple-system,'SF Pro Text','PingFang SC','Helvetica Neue',sans-serif;
      background:var(--bg);background-color:var(--bg-solid);
      color:var(--text);
      padding:0;font-size:14px;line-height:1.6;
      display:flex;flex-direction:column;overflow:hidden;
      -webkit-font-smoothing:antialiased;
    }

    /* ── header ── */
    .header{
      display:flex;align-items:center;gap:8px;
      padding:14px 16px 12px;flex-shrink:0;
      background:var(--glass);
      border-bottom:1px solid var(--border);
      
    }
    .header h1{font-size:16px;font-weight:700;letter-spacing:-.02em;flex:1;color:var(--text)}
    .header-ver{font-size:10px;color:var(--text3);font-family:'SF Mono',ui-monospace,monospace;padding:2px 6px;border-radius:4px;background:var(--glass);opacity:.7}
    .status-dot{width:7px;height:7px;border-radius:50%;background:var(--text3);transition:background .3s;flex-shrink:0}
    .status-dot.ok{background:var(--green)}
    .status-dot.warn{background:var(--orange);animation:pulse 1.5s infinite}
    .status-dot.err{background:var(--red)}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
    .btn-header{
      width:30px;height:30px;padding:0;font-size:11px;font-weight:500;border-radius:8px;
      border:1px solid var(--border);background:var(--glass);color:var(--text2);cursor:pointer;
      transition:all .2s ease;display:inline-flex;align-items:center;justify-content:center;

    }
    .btn-header:hover{color:var(--text);background:var(--glass-strong);border-color:var(--border)}

    /* ── tabs ── */
    .tab-bar{display:flex;gap:4px;align-items:center;padding:8px 16px;flex-wrap:wrap;flex-shrink:0}
    .tab{
      padding:6px 14px;border-radius:8px;font-size:12.5px;font-weight:500;
      border:1px solid transparent;background:transparent;color:var(--text3);
      cursor:pointer;transition:all .2s ease;position:relative;white-space:nowrap;
      display:inline-flex;align-items:center;max-width:100%;
    }
    .tab:hover{background:var(--glass);color:var(--text2);border-color:var(--border)}
    .tab.active{background:var(--accent-soft);color:var(--text);border-color:var(--border)}
    .tab-label{min-width:0;overflow:hidden;text-overflow:ellipsis}
    .tab .tab-x{
      display:none;margin-left:4px;font-size:9px;width:15px;height:15px;
      border-radius:50%;border:none;background:var(--glass-strong);color:var(--text3);
      cursor:pointer;line-height:15px;text-align:center;vertical-align:middle;flex-shrink:0;
    }
    .tab:hover .tab-x{display:inline-block}
    .tab.active .tab-x{background:var(--accent-soft);color:var(--text)}
    .tab input{
      background:transparent;border:none;outline:none;color:inherit;font:inherit;
      font-size:12px;width:56px;padding:0;margin:0;
    }
    .tab.active input{color:var(--text)}
    .tab-add{
      width:30px;height:30px;border-radius:8px;border:1px dashed var(--border);
      background:transparent;color:var(--text3);font-size:16px;cursor:pointer;
      display:flex;align-items:center;justify-content:center;transition:all .2s ease;flex-shrink:0;
    }
    .tab-add:hover{color:var(--blue);border-color:var(--blue);background:var(--accent-soft)}
    .tab-add:disabled{opacity:.3;cursor:not-allowed}

    /* ── main scroll ── */
    .main{flex:1;overflow-y:auto;overflow-x:hidden;padding:0 16px 10px}
    .main::-webkit-scrollbar{width:3px}
    .main::-webkit-scrollbar-track{background:transparent}
    .main::-webkit-scrollbar-thumb{background:var(--border);border-radius:99px}

    /* ── config section ── */
    .config-section{
      background:var(--card-solid);border:1px solid var(--border);border-radius:var(--r);
      margin-bottom:12px;padding:0;overflow:hidden;
    }
    .config-summary{
      display:flex;align-items:center;gap:6px;padding:10px 14px;cursor:pointer;
      list-style:none;font-size:13px;font-weight:600;color:var(--text2);user-select:none;
    }
    .config-summary::-webkit-details-marker{display:none}
    .config-summary::before{content:'';display:inline-block;width:0;height:0;border-left:4.5px solid var(--text3);border-top:3.5px solid transparent;border-bottom:3.5px solid transparent;transition:transform .2s;flex-shrink:0;opacity:.6}
    details[open] .config-summary::before{transform:rotate(90deg)}
    .config-body{padding:0 14px 14px}
    .config-row{display:flex;gap:6px;margin-bottom:8px}
    .config-input{
      flex:1;padding:9px 12px;border:1px solid var(--border);border-radius:8px;
      background:var(--input-bg);color:var(--text);font-size:13px;outline:none;
      font-family:'SF Mono',ui-monospace,monospace;transition:border-color .2s,box-shadow .2s;
    }
    .config-input:focus{border-color:var(--blue);box-shadow:0 0 0 3px var(--accent-soft)}
    .config-input::placeholder{color:var(--text3)}
    .config-path{font-size:11px;color:var(--text3);padding:2px 0;font-family:'SF Mono',ui-monospace,monospace;word-break:break-all}
    .config-path.ok{color:var(--green)}
    .cleanup-row{align-items:center;justify-content:space-between;gap:8px}
    .cleanup-tip{flex:1;font-size:11px;line-height:1.45;color:var(--text3)}

    /* ── memo ── */
    .memo-row{margin-top:8px}
    .memo-label{font-size:11px;color:var(--text3);margin-bottom:4px}
    .memo-input{
      width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:8px;
      background:var(--input-bg);color:var(--text);font-size:13px;outline:none;transition:border-color .2s,box-shadow .2s;
    }
    .memo-input:focus{border-color:var(--blue);box-shadow:0 0 0 3px var(--accent-soft)}
    .memo-input::placeholder{color:var(--text3);font-size:12px}

    /* ── buttons ── */
    .btn{
      display:inline-flex;align-items:center;gap:4px;padding:7px 14px;
      border:1px solid var(--border);
      border-radius:8px;font-size:12.5px;font-weight:500;cursor:pointer;
      transition:all .2s ease;background:var(--card-solid);color:var(--text2);letter-spacing:-.01em;
    }
    .btn:hover{background:var(--glass-strong);color:var(--text);border-color:var(--border)}
    .btn:active{transform:scale(.97);opacity:.9}
    .btn:disabled{opacity:.3;cursor:not-allowed}
    .btn-blue{background:var(--accent-soft);color:var(--blue);border-color:var(--border)}
    .btn-blue:hover{background:var(--hover-bg);color:var(--blue-hover);border-color:var(--blue)}
    .btn-danger{background:rgba(248,113,113,.08);color:var(--red);border-color:rgba(248,113,113,.25)}
    .btn-danger:hover{background:rgba(248,113,113,.14);color:var(--red);border-color:rgba(248,113,113,.45)}
    .btn-sm{padding:5px 11px;font-size:12px;border-radius:6px}
    .btn-icon{width:32px;height:32px;padding:0;border-radius:8px;justify-content:center}

    /* ── connection banner ── */
    .conn-banner{
      padding:10px 14px;background:var(--card-solid);color:var(--text2);
      border:1px solid var(--border);border-radius:var(--r);margin-bottom:12px;font-size:13px;line-height:1.5;
      transition:max-height .3s,padding .3s,margin .3s,opacity .3s;
      overflow:hidden;max-height:104px;
    }
    .conn-banner.hidden{max-height:0;padding:0 14px;margin:0;opacity:0;border-width:0}
    .conn-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px}
    .conn-hint-row{display:flex;align-items:center;gap:8px}
    .conn-banner .conn-hint{flex:1;min-width:0;opacity:.65;font-size:11px;color:var(--text3);line-height:1.5}
    .conn-banner code{
      background:var(--glass-strong);color:var(--text2);padding:2px 7px;border-radius:5px;
      font-family:'SF Mono',ui-monospace,monospace;font-size:11px;border:none;word-break:break-all;
      cursor:pointer;user-select:all;
    }
    .conn-banner code:hover{background:var(--accent-soft);color:var(--blue)}
    .hint-status{font-size:10.5px;color:var(--text3);white-space:nowrap;flex-shrink:0}
    .btn-copy-hint{padding:4px 10px;font-size:11px;border-radius:6px;flex-shrink:0}

    /* ── composer ── */
    .composer{
      background:var(--glass);border:1px solid var(--border);border-radius:var(--r);
      padding:0;margin-bottom:12px;overflow:hidden;
    }
    .composer .msg-input{
      width:100%;min-height:100px;max-height:280px;overflow-y:auto;padding:12px 14px;
      border:none;border-radius:0;background:transparent;color:var(--text);
      font-size:14px;font-family:inherit;line-height:1.55;outline:none;
      white-space:pre-wrap;word-break:break-word;resize:none;
    }
    .composer .msg-input:focus{background:transparent}
    .composer .msg-input.is-empty:before{
      content:attr(data-placeholder);color:var(--text3);pointer-events:none;opacity:.5;
      display:block;
    }
    .composer .msg-input:not(.is-empty):before{content:none}
    .toolbar{display:flex;gap:4px;align-items:center;padding:8px 12px;flex-wrap:wrap;border-top:1px solid var(--border)}
    .toolbar-left{display:flex;gap:4px;align-items:center;flex:1;flex-wrap:wrap}
    .toolbar-right{display:flex;gap:6px;align-items:center}
    .btn-send{
      width:36px;height:36px;min-width:36px;padding:0;border-radius:50%;
      display:inline-flex;align-items:center;justify-content:center;
      background:var(--accent-gradient);border:none;color:#fff;
      box-shadow:0 2px 8px var(--glow);
    }
    .btn-send:hover{box-shadow:0 4px 16px var(--glow);transform:scale(1.05)}
    .btn-send svg{width:15px;height:15px}
    .attach-chips{display:flex;flex-wrap:wrap;gap:4px;padding:0 14px 8px}
    .chip{
      font-size:11px;padding:3px 8px 3px 9px;background:var(--glass-strong);
      border:none;border-radius:6px;display:inline-flex;align-items:center;gap:4px;color:var(--text2);
    }
    .chip span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:120px}
    .chip .rm{border:none;background:none;color:var(--text3);cursor:pointer;padding:0 2px;font-size:11px;line-height:1}
    .chip .rm:hover{color:var(--red)}
    .chip.chip-img{padding:4px 7px 4px 5px;gap:5px}
    .chip .chip-thumb{
      border:none;background:transparent;padding:0;margin:0;cursor:zoom-in;border-radius:6px;overflow:hidden;
      flex-shrink:0;line-height:0;display:block;
    }
    .chip .chip-thumb:focus-visible{outline:2px solid var(--blue);outline-offset:2px}
    .chip .chip-thumb img{width:34px;height:34px;object-fit:cover;border-radius:6px;display:block;vertical-align:middle}
    .chip .chip-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:120px;font-size:11px}

    /* ── image attachment preview overlay ── */
    .img-preview-overlay{
      display:none;position:fixed;inset:0;z-index:100001;align-items:center;justify-content:center;
      padding:24px;box-sizing:border-box;
    }
    .img-preview-overlay.visible{display:flex}
    .img-preview-overlay .img-preview-backdrop{position:absolute;inset:0;background:var(--overlay-bg);cursor:pointer}
    .img-preview-overlay img{
      position:relative;z-index:1;max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain;
      border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,.6);
    }

    /* ── chat ── */
    .chat-section{
      background:transparent;border:none;border-radius:0;
      overflow:visible;margin-top:8px;padding-top:12px;
      border-top:1px solid var(--border);
    }
    .chat-head{
      display:flex;align-items:center;justify-content:space-between;padding:0 0 8px;
      border-bottom:none;background:transparent;
    }
    .chat-head-title{font-size:12px;font-weight:600;color:var(--text3);letter-spacing:.02em;text-transform:none}
    .chat-head .btn.btn-sm{padding:3px 8px;font-size:11px;opacity:.5}
    .chat-head .btn.btn-sm:hover{opacity:1}
    .chat-body{max-height:240px;overflow-y:auto;padding:4px 0 6px}
    .chat-body::-webkit-scrollbar{width:3px}
    .chat-body::-webkit-scrollbar-track{background:transparent}
    .chat-body::-webkit-scrollbar-thumb{background:var(--border);border-radius:99px}

    /* ── message bubbles ── */
    .msg{max-width:88%;padding:10px 14px;border-radius:14px;margin-bottom:8px;animation:fadeUp .25s;word-break:break-word}
    .msg:last-child{margin-bottom:0}
    @keyframes fadeUp{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
    .msg.user{
      margin-left:auto;margin-right:0;
      background:var(--user-msg-bg);
      color:var(--text);
      border:1px solid var(--border);
      border-bottom-right-radius:6px;
    }
    .msg.cursor{
      margin-right:auto;margin-left:0;
      background:var(--glass);
      border:1px solid var(--border);
      border-bottom-left-radius:6px;
    }
    .msg.system{
      margin:0 0 6px 0;margin-right:auto;text-align:left;font-size:11px;color:var(--text3);
      background:transparent;
      max-width:92%;padding:3px 2px 4px;border-radius:0;border:none;
      opacity:.7;
    }
    .msg-head{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:3px;font-size:10px;opacity:.55}
    .msg.user .msg-head{color:var(--text2)}
    .msg.cursor .msg-head{color:var(--text3)}
    .msg-who{font-weight:600;text-transform:uppercase;letter-spacing:.03em;font-size:10px}
    .msg.cursor .msg-who{color:var(--blue)}
    .msg.user .msg-who{color:var(--blue)}
    .msg-time{font-size:10px;opacity:.5;font-weight:400}
    .msg-body{white-space:pre-wrap;word-break:break-word;font-size:13.5px;line-height:1.5}
    .msg.user .msg-body{color:var(--text)}
    .msg.system .msg-body{font-size:11px;line-height:1.42;opacity:.9}

    /* ── empty state ── */
    .empty{text-align:center;padding:32px 16px;color:var(--text3)}
    .empty-icon{margin-bottom:10px;opacity:.2}
    .empty-title{font-size:14px;font-weight:600;margin-bottom:4px;color:var(--text2)}
    .empty-sub{font-size:12.5px;opacity:.5}

    /* ── feedback ── */
    .feedback{margin-top:6px;padding:7px 10px;border-radius:8px;font-size:12px;display:none;animation:fadeUp .2s;white-space:pre-wrap;word-break:break-all}
    .feedback.show{display:block}
    .feedback.success{background:rgba(52,211,153,.08);color:var(--green);border:1px solid rgba(52,211,153,.15)}
    .feedback.error{background:rgba(248,113,113,.06);color:var(--red);border:1px solid rgba(248,113,113,.12)}
    .feedback.info{background:var(--accent-soft);color:var(--blue);border:1px solid var(--border)}
    .feedback.pending{background:var(--glass);color:var(--text2);border:1px solid var(--border)}

    /* ── voice ── */
    .btn-voice{
      display:inline-flex;align-items:center;justify-content:center;
      width:32px;height:32px;padding:0;
      border:1px solid var(--border);border-radius:50%;font-size:0;
      cursor:pointer;transition:all .2s ease;background:var(--glass);color:var(--text3);
    }
    .btn-voice svg{flex-shrink:0}
    .btn-voice:hover{border-color:var(--blue);color:var(--blue);background:var(--accent-soft)}
    .btn-voice:disabled{opacity:.3;cursor:not-allowed}
    .btn-voice.listening{border-color:rgba(248,113,113,.35);color:var(--red);animation:pulse 1.2s infinite}

    /* ── help overlay ── */
    .help-overlay{display:none;position:fixed;inset:0;z-index:100000;align-items:center;justify-content:center;padding:12px}
    .help-overlay.visible{display:flex}
    .help-backdrop{position:absolute;inset:0;background:var(--overlay-bg)}
    .help-panel{
      position:relative;z-index:1;width:min(400px,100%);max-height:min(80vh,560px);
      display:flex;flex-direction:column;background:var(--help-bg);
      border:1px solid var(--border);border-radius:18px;box-shadow:0 20px 60px var(--shadow);
      overflow:hidden;
    }
    .help-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--border);flex-shrink:0}
    .help-head h3{font-size:15px;font-weight:700;color:var(--text)}
    .help-body{padding:16px;overflow-y:auto;font-size:12.5px;line-height:1.7;color:var(--text2)}
    .help-body .hh{font-size:13px;font-weight:700;color:var(--text);margin:16px 0 6px;padding-bottom:4px;border-bottom:1px solid var(--border)}
    .help-body .hh:first-of-type{margin-top:0}
    .help-body ul{margin:6px 0;padding-left:18px}
    .help-body li{margin:5px 0}
    .help-body code{font-family:'SF Mono',ui-monospace,monospace;font-size:11px;background:var(--glass-strong);padding:2px 6px;border-radius:5px;color:var(--blue)}
    .help-step{display:flex;gap:10px;margin:8px 0;padding:8px 10px;background:var(--glass);border-radius:10px}
    .help-num{flex-shrink:0;width:22px;height:22px;border-radius:50%;background:var(--accent-gradient);color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center}

    /* ── preset commands ── */
    .presets-config{margin-top:12px;padding-top:10px;border-top:1px solid var(--border)}
    .presets-config-label{font-size:11px;color:var(--text3);margin-bottom:6px;font-weight:600}
    .presets-config-list{display:flex;flex-direction:column;gap:6px;margin-bottom:8px}
    .preset-config-row{display:flex;gap:6px;align-items:center}
    .preset-config-input{
      flex:1;padding:7px 10px;border:1px solid var(--border);border-radius:8px;
      background:var(--input-bg);color:var(--text);font-size:12px;outline:none;
      font-family:inherit;transition:border-color .2s,box-shadow .2s;
    }
    .preset-config-input:focus{border-color:var(--blue);box-shadow:0 0 0 3px var(--accent-soft)}
    .preset-config-input::placeholder{color:var(--text3);font-size:11px}
    .preset-rm{
      width:22px;height:22px;padding:0;border-radius:50%;border:1px solid var(--border);
      background:transparent;color:var(--text3);cursor:pointer;font-size:11px;
      display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .15s;
    }
    .preset-rm:hover{color:var(--red);border-color:rgba(248,113,113,.4);background:rgba(248,113,113,.06)}
    .presets-bar{display:flex;flex-wrap:wrap;gap:5px}
    .presets-bar:empty{display:none}
    .preset-chip{
      padding:5px 11px;font-size:12px;font-weight:500;
      border:1px solid var(--border);border-radius:14px;
      background:var(--glass-strong);color:var(--text2);cursor:pointer;
      transition:all .2s ease;font-family:inherit;line-height:1.3;
      text-align:left;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
    }
    .preset-chip:hover{background:var(--accent-soft);color:var(--blue);border-color:var(--blue)}
    .preset-chip:active{transform:scale(.96)}

    /* ── next steps ── */
    .next-steps{
      padding:10px 14px;margin:-4px 0 8px;
      background:var(--glass);border:1px solid var(--border);border-radius:var(--r);
      animation:fadeUp .25s;
    }
    .next-steps-label{font-size:11px;color:var(--text3);margin-bottom:6px;font-weight:600}
    .next-steps-btns{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}
    .next-step-btn{
      padding:6px 12px;font-size:12.5px;font-weight:500;
      border:1px solid var(--border);border-radius:16px;
      background:var(--card-solid);color:var(--blue);cursor:pointer;
      transition:all .2s ease;font-family:inherit;line-height:1.4;
      text-align:left;max-width:100%;word-break:break-word;
    }
    .next-step-btn:hover{background:var(--accent-soft);border-color:var(--blue);transform:scale(1.02)}
    .next-step-btn:active{transform:scale(.97)}
    .next-steps-input-row{display:flex;gap:6px;align-items:center}
    .next-steps-input{
      flex:1;padding:7px 12px;border:1px solid var(--border);border-radius:8px;
      background:var(--input-bg);color:var(--text);font-size:13px;outline:none;
      font-family:inherit;transition:border-color .2s,box-shadow .2s;
    }
    .next-steps-input:focus{border-color:var(--blue);box-shadow:0 0 0 3px var(--accent-soft)}
    .next-steps-input::placeholder{color:var(--text3);font-size:12px}
    .next-steps-send{
      width:30px;height:30px;min-width:30px;padding:0;border-radius:50%;
      display:inline-flex;align-items:center;justify-content:center;
      background:var(--accent-gradient);border:none;color:#fff;cursor:pointer;
      transition:all .2s ease;flex-shrink:0;
    }
    .next-steps-send:hover{transform:scale(1.08);box-shadow:0 2px 8px var(--glow)}
    .next-steps-send svg{width:12px;height:12px}

    .loading-spinner{display:inline-block;width:12px;height:12px;border:2px solid var(--border);border-top-color:var(--blue);border-radius:50%;animation:spin .7s linear infinite}
    @keyframes spin{to{transform:rotate(360deg)}}`;
}
exports.getStyles = getStyles;
