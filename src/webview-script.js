"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const { MAX_SESSION_HISTORY_ITEMS, MAX_ATTACH_BASE64_CHARS } = require("./constants");

function getScript(nonce, maxSessions, platform) {
    const body = `    const vscodeApi = acquireVsCodeApi();
    var VOICE_USE_WIN_NATIVE = <<<__SC_VOICE__>>>;

    // ── theme ──
    (function(){
      var themes=['light'];
      var themeNames={light:'Light'};
      var saved=localStorage.getItem('sidechat.theme');
      if(saved&&themes.indexOf(saved)>=0) document.documentElement.dataset.theme=saved;
      else document.documentElement.dataset.theme='light';
      var btn=document.getElementById('themeToggleBtn');
      if(btn) btn.addEventListener('click',function(){
        var cur=document.documentElement.dataset.theme||'light';
        var idx=themes.indexOf(cur);var next=themes[(idx+1)%themes.length];
        document.documentElement.dataset.theme=next;
        localStorage.setItem('sidechat.theme',next);
        btn.title=themeNames[next]||next;
      });
    })();

    // ── help overlay ──
    (function(){
      var ov=document.getElementById('helpOverlay'),cb=document.getElementById('closeHelpBtn'),
          bd=document.getElementById('helpBackdrop'),ob=document.getElementById('openHelpBtn');
      function open(){if(ov){ov.classList.add('visible');ov.setAttribute('aria-hidden','false')}}
      function close(){if(ov){ov.classList.remove('visible');ov.setAttribute('aria-hidden','true')}}
      if(ob)ob.addEventListener('click',open);
      if(cb)cb.addEventListener('click',close);
      if(bd)bd.addEventListener('click',close);
      document.addEventListener('keydown',function(e){if(e.key==='Escape'&&ov&&ov.classList.contains('visible'))close()});
    })();

    // ── config toggle ──
    (function(){
      var btn=document.getElementById('toggleConfigBtn');
      var det=document.getElementById('configDetails');
      if(btn&&det) btn.addEventListener('click',function(){
        if(det.hasAttribute('open')) det.removeAttribute('open');
        else det.setAttribute('open','');
      });
    })();

    const statusDot = document.getElementById('statusDot');
    const pathInput = document.getElementById('pathInput');
    const browseBtn = document.getElementById('browseBtn');
    const cfgBtn = document.getElementById('cfgBtn');
    const cleanupArtifactsBtn = document.getElementById('cleanupArtifactsBtn');
    const useCurrentBtn = document.getElementById('useCurrentBtn');
    const cfgFeedback = document.getElementById('cfgFeedback');
    const msgInput = document.getElementById('msgInput');
    const voiceInputBtn = document.getElementById('voiceInputBtn');
    const sendBtn = document.getElementById('sendBtn');
    const sendFeedback = document.getElementById('sendFeedback');
    const chatContainer = document.getElementById('chatContainer');
    const messagesList = document.getElementById('messagesList');
    const emptyState = document.getElementById('emptyState');
    const attachChips = document.getElementById('attachChips');
    const imgPreviewOverlay = document.getElementById('imgPreviewOverlay');
    const imgPreviewBackdrop = document.getElementById('imgPreviewBackdrop');
    const imgPreviewFull = document.getElementById('imgPreviewFull');
    const clearChatBtn = document.getElementById('clearChatBtn');
    const tabBar = document.getElementById('tabBar');
    const addSessionBtn = document.getElementById('addSessionBtn');
    const hintPhrase = document.getElementById('hintPhrase');
    const copyHintBtn = document.getElementById('copyHintBtn');
    const copyContinueHintBtn = null;
    const hintStatus = document.getElementById('hintStatus');
    const sendMessageSection = document.getElementById('sendMessageSection');
    const sessionMemoBadge = document.getElementById('sessionMemoBadge');
    const sessionMemoInput = document.getElementById('sessionMemoInput');
    const currentPathDisplay = document.getElementById('currentPathDisplay');
    const configDetails = document.getElementById('configDetails');
    const connectionBanner = document.getElementById('connectionBanner');
    const copyPhraseBtn = document.getElementById('copyPhraseBtn');

    var MAX_SESSIONS = <<<__SC_MAX_SESSIONS__>>>;
    var MAX_HISTORY_MESSAGES_PER_SESSION = <<<__SC_MAX_HIST__>>>;
    var MAX_ATTACH_BASE64_TOTAL = <<<__SC_MAX_ATTACH__>>>;
    var sessionOrder = ['1'];
    var activeSessionId = '1';
    var messagesBySession = {};
    var pendingBySession = {};
    var persistTimer = null;
    var sessionOrderTimer = null;
    var memoTimer = null;
    var draftTimer = null;
    var workspacePathTimer = null;
    var sessionMemos = {};
    var draftsBySession = {};
    var runtimeBySession = {};
    let currentWorkspacePath = '';

    function updateComposerEmptyClass(){
      if(!msgInput)return;
      var t=(msgInput.innerText||'').replace(/\\u200b/g,'').trim();
      msgInput.classList.toggle('is-empty',!t);
    }
    function getComposerPlainTextForSend(root){
      if(!root)return'';
      return (root.innerText||'').replace(/\\u200b/g,'');
    }

    function sessionToneClass(sid) { return 'session-tone-' + ((parseInt(sid,10)||1) - 1) % 12; }
    function normalizeMessageType(type) { return type==='cursor'||type==='system' ? type : 'user'; }
    function trimSessionMessages(items) {
      if (!Array.isArray(items)) return [];
      return items.length <= MAX_HISTORY_MESSAGES_PER_SESSION ? items : items.slice(items.length - MAX_HISTORY_MESSAGES_PER_SESSION);
    }
    function estimateBase64CharsFromBytes(n) { return Math.ceil(Math.max(0,Number(n)||0)/3)*4; }
    function getPendingBase64Chars(sid) {
      ensureSessionStructures(sid);
      return (pendingBySession[sid]||[]).reduce(function(s,i){return s+(i&&typeof i.data==='string'?i.data.length:0)},0);
    }
    function describeAttachmentLimit() { return '附件总体积过大（单条约 10MB 上限）'; }
    function getDraftValue(sid) { return String(draftsBySession[sid]||''); }
    function setDraftValue(sid, value) {
      var next=String(value||'').slice(0,4000);
      if(next) draftsBySession[sid]=next; else delete draftsBySession[sid];
    }
    function setComposerHtml(sid, html) {
      if(!msgInput)return;
      msgInput.innerHTML=String(html||'');
      updateComposerEmptyClass();
    }
    function persistDraftsSoon() {
      if(draftTimer) clearTimeout(draftTimer);
      draftTimer=setTimeout(function(){draftTimer=null;vscodeApi.postMessage({command:'persistDrafts',drafts:draftsBySession})},250);
    }
    function persistWorkspacePathSoon() {
      if(workspacePathTimer) clearTimeout(workspacePathTimer);
      workspacePathTimer=setTimeout(function(){workspacePathTimer=null;vscodeApi.postMessage({command:'persistWorkspacePath',path:pathInput?pathInput.value:''})},250);
    }
    function updateCurrentPathDisplay(path, isConfigured) {
      if(!currentPathDisplay)return;
      var p=String(path||'').trim();
      if(p){currentPathDisplay.textContent=(isConfigured?'当前：':'待配置：')+p;currentPathDisplay.classList.add('ok')}
      else{currentPathDisplay.textContent='未选择工作区';currentPathDisplay.classList.remove('ok')}
    }
    function persistMemoSoon() {
      if(memoTimer) clearTimeout(memoTimer);
      memoTimer=setTimeout(function(){memoTimer=null;vscodeApi.postMessage({command:'persistSessionMemos',memos:sessionMemos})},300);
    }
    function ensureSessionStructures(sid) {
      if(!messagesBySession[sid]) messagesBySession[sid]=[];
      if(!pendingBySession[sid]) pendingBySession[sid]=[];
      if(!runtimeBySession[sid]) runtimeBySession[sid]={state:'idle',queueSize:0,heartbeatAt:'',aiDoneAt:'',replyAt:'',lastMessageAt:'',heartbeatFresh:false};
    }
    function getPending() { ensureSessionStructures(activeSessionId); return pendingBySession[activeSessionId]; }

    // ── connection banner ──
    function updateConnectionBanner() {
      if(!connectionBanner)return;
      var rt=runtimeBySession[activeSessionId]||{};
      var connected=rt.state==='connected'||rt.heartbeatFresh;
      connectionBanner.classList.toggle('hidden',connected);
      if(hintPhrase) hintPhrase.textContent='请使用 sidechat-'+activeSessionId+' 的 check_messages';
    }

    // ── session tabs ──
    function setSessionUi() {
      tabBar.querySelectorAll('.tab').forEach(function(el){el.classList.toggle('active',el.getAttribute('data-sid')===activeSessionId)});
      if(sessionMemoBadge) sessionMemoBadge.textContent='MCP-'+activeSessionId;
      if(sessionMemoInput) sessionMemoInput.value=sessionMemos[activeSessionId]||'';
      if(hintPhrase) hintPhrase.textContent='请使用 sidechat-'+activeSessionId+' 的 check_messages';
      if(copyPhraseBtn) copyPhraseBtn.title='复制：请使用 sidechat-'+activeSessionId+' 的 check_messages';
      renderHintStatus();
      updateConnectionBanner();
    }

    function formatRuntimeTime(iso){if(!iso)return'';var d=new Date(iso);return isNaN(d.getTime())?'':d.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}

    function renderHintStatus() {
      ensureSessionStructures(activeSessionId);
      var rt=runtimeBySession[activeSessionId]||{};
      var state=rt.state||'idle';
      var labels={queued:'排队中',processing:'处理中',connected:'已连通',idle:'空闲'};
      var text=labels[state]||'未知';
      if(rt.queueSize>0) text+=' · 队列 '+rt.queueSize;
      var t=rt.replyAt?formatRuntimeTime(rt.replyAt):rt.heartbeatAt?formatRuntimeTime(rt.heartbeatAt):'';
      if(t) text+=' · '+t;
      if(hintStatus) hintStatus.textContent=text;
      if(statusDot){
        statusDot.className='status-dot'+(state==='connected'||rt.heartbeatFresh?' ok':state==='queued'||state==='processing'?' warn':'');
      }
      updateConnectionBanner();
    }

    function getTabLabel(sid) {
      return sessionMemos[sid] || ('MCP-' + sid);
    }

    function renderSessionTabs() {
      if(!tabBar||!addSessionBtn)return;
      sessionOrder.forEach(function(sid){ensureSessionStructures(sid)});
      var tabsHtml=sessionOrder.map(function(sid){
        return '<button type="button" class="tab'+(sid===activeSessionId?' active':'')+'" data-sid="'+sid+'">'+
          '<span class="tab-label">'+escapeHtml(getTabLabel(sid))+'</span>'+
          '<span class="tab-x" data-del-sid="'+sid+'" title="删除">\u00d7</span>'+
        '</button>';
      }).join('');
      var addBtnHtml=addSessionBtn.outerHTML;
      tabBar.innerHTML=tabsHtml+addBtnHtml;
      var newAddBtn=tabBar.querySelector('.tab-add');
      if(newAddBtn){
        newAddBtn.disabled=sessionOrder.length>=MAX_SESSIONS;
        newAddBtn.addEventListener('click',function(){addSession()});
      }
      tabBar.querySelectorAll('.tab').forEach(function(btn){
        btn.addEventListener('click',function(e){
          if(e.target.classList.contains('tab-x')){e.stopPropagation();deleteSession(e.target.getAttribute('data-del-sid'));return}
          switchSession(btn.getAttribute('data-sid'));
        });
        btn.addEventListener('dblclick',function(e){
          if(e.target.classList.contains('tab-x'))return;
          var sid=btn.getAttribute('data-sid');
          startTabRename(btn,sid);
        });
      });
      setSessionUi();
    }

    function startTabRename(tabEl, sid) {
      var labelEl=tabEl.querySelector('.tab-label');
      if(!labelEl)return;
      var currentName=sessionMemos[sid]||'';
      var input=document.createElement('input');
      input.type='text';input.value=currentName;
      input.placeholder='MCP-'+sid;input.maxLength=30;
      labelEl.textContent='';labelEl.appendChild(input);
      input.focus();input.select();
      function finish(){
        var val=input.value.trim().slice(0,30);
        if(val){sessionMemos[sid]=val}else{delete sessionMemos[sid]}
        persistMemoSoon();
        if(sessionMemoInput&&sid===activeSessionId) sessionMemoInput.value=sessionMemos[sid]||'';
        renderSessionTabs();
      }
      input.addEventListener('blur',finish);
      input.addEventListener('keydown',function(e){
        if(e.key==='Enter'){e.preventDefault();input.blur()}
        if(e.key==='Escape'){e.preventDefault();input.value=currentName;input.blur()}
      });
    }

    function switchSession(sid) {
      if(sessionOrder.indexOf(sid)<0)return;
      if(msgInput) setDraftValue(activeSessionId,msgInput.innerHTML);
      activeSessionId=sid;
      setSessionUi();
      if(msgInput) setComposerHtml(activeSessionId,getDraftValue(activeSessionId));
      renderAttachChips();
      renderMessages();
      renderPresetsBar();
      renderPresetsConfig();
    }

    function addSession() {
      if(sessionOrder.length>=MAX_SESSIONS)return;
      var used={};sessionOrder.forEach(function(s){used[s]=true});
      var next=null;
      for(var n=1;n<=MAX_SESSIONS;n++){var id=String(n);if(!used[id]){next=id;break}}
      if(!next)return;
      ensureSessionStructures(next);sessionOrder.push(next);activeSessionId=next;
      if(msgInput)setComposerHtml(activeSessionId,getDraftValue(activeSessionId));
      renderAttachChips();
      persistSessionOrderSoon();renderSessionTabs();renderMessages();schedulePersist();
      hintReconfigureAfterSessionChange();
    }

    function deleteSession(sid) {
      if(!sid||sessionOrder.length<=1){showFeedback(sendFeedback,'error','至少保留一个会话');return}
      var idx=sessionOrder.indexOf(sid);if(idx<0)return;
      sessionOrder.splice(idx,1);
      delete messagesBySession[sid];delete pendingBySession[sid];delete sessionMemos[sid];delete draftsBySession[sid];
      persistMemoSoon();persistDraftsSoon();renderAttachChips();
      if(activeSessionId===sid) activeSessionId=sessionOrder[0];
      persistSessionOrderSoon();renderSessionTabs();renderMessages();schedulePersist();
      hintReconfigureAfterSessionChange();
      vscodeApi.postMessage({command:'deleteSessionData',sessionId:sid,order:sessionOrder.slice()});
      showFeedback(sendFeedback,'info','已删除 MCP-'+sid);
    }

    if(sessionMemoInput){
      sessionMemoInput.addEventListener('input',function(){
        var v=sessionMemoInput.value.slice(0,200);sessionMemoInput.value=v;
        sessionMemos[activeSessionId]=v;if(!v)delete sessionMemos[activeSessionId];
        persistMemoSoon();
        renderSessionTabs();
      });
    }
    if(pathInput){
      pathInput.addEventListener('input',function(){
        updateCurrentPathDisplay(pathInput.value,currentWorkspacePath===pathInput.value.trim()&&!!currentWorkspacePath);
        persistWorkspacePathSoon();
      });
    }

    ['1','2','3'].forEach(function(s){ensureSessionStructures(s)});
    renderSessionTabs();
    if(msgInput) setComposerHtml(activeSessionId,getDraftValue(activeSessionId));
    updateCurrentPathDisplay('',false);

    // ── preset commands ──
    var MAX_PRESETS = 10;
    var presetsBySession = {};
    var presetsBar = document.getElementById('presetsBar');
    var presetsConfigList = document.getElementById('presetsConfigList');
    var addPresetBtn = document.getElementById('addPresetBtn');
    var presetsTimer = null;

    function getPresets(sid) { return Array.isArray(presetsBySession[sid]) ? presetsBySession[sid] : []; }
    function setPresets(sid, arr) { presetsBySession[sid] = (arr||[]).filter(function(s){return typeof s==='string'}).map(function(s){return s.slice(0,200)}).slice(0,MAX_PRESETS); }
    function persistPresetsSoon() {
      if(presetsTimer) clearTimeout(presetsTimer);
      presetsTimer=setTimeout(function(){presetsTimer=null;vscodeApi.postMessage({command:'persistPresets',presets:presetsBySession})},300);
    }
    function renderPresetsBar() {
      if(!presetsBar)return;
      var items = getPresets(activeSessionId);
      var filled = [];
      items.forEach(function(text,i){if(text&&text.trim()) filled.push({text:text.trim(),idx:i})});
      if(filled.length===0){presetsBar.innerHTML='';return}
      presetsBar.innerHTML=filled.map(function(o){
        return '<button type="button" class="preset-chip" data-preset-idx="'+o.idx+'" title="'+escapeHtml(o.text)+'">'+escapeHtml(o.text)+'</button>';
      }).join('');
    }
    function renderPresetsConfig() {
      if(!presetsConfigList||!addPresetBtn)return;
      var items = getPresets(activeSessionId);
      addPresetBtn.style.display = items.length>=MAX_PRESETS?'none':'';
      presetsConfigList.innerHTML=items.map(function(text,i){
        return '<div class="preset-config-row">'+
          '<input type="text" class="preset-config-input" data-preset-cfg="'+i+'" value="'+escapeHtml(String(text||''))+'" placeholder="输入常用指令…" maxlength="200" />'+
          '<button type="button" class="preset-rm" data-preset-del="'+i+'" title="删除">\u00d7</button>'+
        '</div>';
      }).join('');
    }
    if(presetsBar) presetsBar.addEventListener('click',function(e){
      var btn=e.target&&e.target.closest?e.target.closest('.preset-chip'):null;
      if(!btn)return;
      var idx=parseInt(btn.getAttribute('data-preset-idx')||'-1',10);
      var items=getPresets(activeSessionId);
      if(idx>=0&&items[idx]){
        var presetText=String(items[idx]).trim();
        if(msgInput){
          var existing=getComposerPlainTextForSend(msgInput).trim();
          var combined=existing?(existing+'\\n'+presetText):presetText;
          msgInput.innerHTML='';
          msgInput.appendChild(document.createTextNode(combined));
          updateComposerEmptyClass();
          setDraftValue(activeSessionId,msgInput.innerHTML);
          persistDraftsSoon();
          msgInput.focus();
        }
      }
    });
    if(presetsConfigList) presetsConfigList.addEventListener('input',function(e){
      var inp=e.target;if(!inp||!inp.hasAttribute||!inp.hasAttribute('data-preset-cfg'))return;
      var idx=parseInt(inp.getAttribute('data-preset-cfg')||'-1',10);
      var items=getPresets(activeSessionId);
      if(idx>=0&&idx<items.length){items[idx]=inp.value.slice(0,200);setPresets(activeSessionId,items);persistPresetsSoon();renderPresetsBar()}
    });
    if(presetsConfigList) presetsConfigList.addEventListener('click',function(e){
      var btn=e.target&&e.target.closest?e.target.closest('[data-preset-del]'):null;
      if(!btn)return;
      var idx=parseInt(btn.getAttribute('data-preset-del')||'-1',10);
      var items=getPresets(activeSessionId);
      if(idx>=0&&idx<items.length){items.splice(idx,1);setPresets(activeSessionId,items);persistPresetsSoon();renderPresetsConfig();renderPresetsBar()}
    });
    if(addPresetBtn) addPresetBtn.addEventListener('click',function(){
      var items=getPresets(activeSessionId);
      if(items.length>=MAX_PRESETS)return;
      items.push('');setPresets(activeSessionId,items);persistPresetsSoon();renderPresetsConfig();
      var lastInput=presetsConfigList?presetsConfigList.querySelector('.preset-config-row:last-child .preset-config-input'):null;
      if(lastInput) lastInput.focus();
    });
    renderPresetsBar();
    renderPresetsConfig();

    copyHintBtn.addEventListener('click',function(){vscodeApi.postMessage({command:'copyCheckPhrase',sessionId:activeSessionId})});
    if(hintPhrase) hintPhrase.addEventListener('click',function(){vscodeApi.postMessage({command:'copyCheckPhrase',sessionId:activeSessionId})});
    if(copyPhraseBtn) copyPhraseBtn.addEventListener('click',function(){vscodeApi.postMessage({command:'copyCheckPhrase',sessionId:activeSessionId})});

    function persistSessionOrderSoon() {
      if(sessionOrderTimer)clearTimeout(sessionOrderTimer);
      sessionOrderTimer=setTimeout(function(){sessionOrderTimer=null;vscodeApi.postMessage({command:'persistSessionOrder',order:sessionOrder.slice()})},200);
    }
    function schedulePersist() {
      if(persistTimer)clearTimeout(persistTimer);
      persistTimer=setTimeout(function(){
        persistTimer=null;var out={};
        Object.keys(messagesBySession).forEach(function(sid){
          out[sid]=trimSessionMessages(messagesBySession[sid]||[]).map(function(m){return{type:m.type,content:m.content,time:m.time instanceof Date?m.time.toISOString():m.time}});
        });
        vscodeApi.postMessage({command:'persistHistories',payload:JSON.stringify(out)});
      },400);
    }
    function showFeedback(el,type,text){el.className='feedback show '+type;el.textContent=text;if(type==='success'||type==='info')setTimeout(function(){el.classList.remove('show')},8000)}

    function formatTime(d){
      if(!d)return'';
      var date=d instanceof Date?d:new Date(d);
      if(isNaN(date.getTime()))return'';
      var now=Date.now();var diff=now-date.getTime();
      if(diff<60000)return'刚刚';
      if(diff<3600000)return Math.floor(diff/60000)+' 分钟前';
      if(diff<86400000)return Math.floor(diff/3600000)+' 小时前';
      return date.toLocaleDateString('zh-CN',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
    }
    setInterval(function(){renderMessages()},60000);

    function escapeHtml(text){var div=document.createElement('div');div.textContent=text;return div.innerHTML}

    function addMessage(type,content,time,sessionId){
      var sid=sessionId||activeSessionId;
      if(!messagesBySession[sid])messagesBySession[sid]=[];
      messagesBySession[sid].push({type:normalizeMessageType(type),content:content,time:time||new Date()});
      messagesBySession[sid]=trimSessionMessages(messagesBySession[sid]);
      if(sid===activeSessionId) renderMessages();
      schedulePersist();
    }
    clearChatBtn.addEventListener('click',function(){
      messagesBySession[activeSessionId]=[];renderMessages();schedulePersist();
      vscodeApi.postMessage({command:'clearSessionQueue',sessionId:activeSessionId});
    });

    var nextStepsBySession = {};

    function renderNextSteps() {
      var existing = chatContainer.querySelector('.next-steps');
      if (existing) existing.remove();
      var suggestions = nextStepsBySession[activeSessionId];
      if (!suggestions || !Array.isArray(suggestions) || suggestions.length === 0) return;
      var div = document.createElement('div');
      div.className = 'next-steps';
      var btnsHtml = suggestions.map(function(s) {
        return '<button type="button" class="next-step-btn">' + escapeHtml(s) + '</button>';
      }).join('');
      div.innerHTML =
        '<div class="next-steps-label">下一步</div>' +
        '<div class="next-steps-btns">' + btnsHtml + '</div>' +
        '<div class="next-steps-input-row">' +
          '<input type="text" class="next-steps-input" placeholder="或者输入你想做的…" />' +
          '<button type="button" class="next-steps-send" title="发送">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>' +
          '</button>' +
        '</div>';
      chatContainer.appendChild(div);
      div.querySelectorAll('.next-step-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var text = btn.textContent.trim();
          if (!text) return;
          sendNextStepText(text);
        });
      });
      var nInput = div.querySelector('.next-steps-input');
      var nSend = div.querySelector('.next-steps-send');
      if (nSend) nSend.addEventListener('click', function() {
        var text = (nInput && nInput.value || '').trim();
        if (!text) return;
        sendNextStepText(text);
      });
      if (nInput) nInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          var text = nInput.value.trim();
          if (!text) return;
          sendNextStepText(text);
        }
      });
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    function sendNextStepText(text) {
      nextStepsBySession[activeSessionId] = null;
      var existing = chatContainer.querySelector('.next-steps');
      if (existing) existing.remove();
      if (msgInput) {
        msgInput.innerHTML = '';
        msgInput.appendChild(document.createTextNode(text));
        updateComposerEmptyClass();
      }
      sendMessage();
    }

    function renderMessages(){
      var messages=messagesBySession[activeSessionId]||[];
      if(messages.length===0){messagesList.innerHTML='';emptyState.style.display='block';return}
      emptyState.style.display='none';
      messagesList.innerHTML=messages.map(function(m){
        if(m.type==='system'){
          return '<div class="msg system"><div class="msg-body">'+escapeHtml(m.content)+'</div></div>';
        }
        var label=m.type==='user'?'你':'Cursor';
        return '<div class="msg '+m.type+'"><div class="msg-head"><span class="msg-who">'+label+'</span><span class="msg-time">'+formatTime(m.time)+'</span></div><div class="msg-body">'+escapeHtml(m.content)+'</div></div>';
      }).join('');
      renderNextSteps();
      chatContainer.scrollTop=chatContainer.scrollHeight;
    }

    function setLoading(btn,loading){
      if(loading){
        btn.disabled=true;btn.dataset.originalHtml=btn.innerHTML;
        if(btn.classList&&btn.classList.contains('btn-send')){btn.innerHTML='<span class="loading-spinner"></span>'}
        else{btn.innerHTML='<span class="loading-spinner"></span> 处理中...'}
      }else{btn.disabled=false;btn.innerHTML=btn.dataset.originalHtml||btn.innerHTML}
    }

    browseBtn.addEventListener('click',function(){vscodeApi.postMessage({command:'selectFolder'})});
    useCurrentBtn.addEventListener('click',function(){vscodeApi.postMessage({command:'requestCurrentWorkspace'})});

    function hintReconfigureAfterSessionChange(){showFeedback(cfgFeedback,'info','会话已变：请再点「开始配置」同步 .cursor/mcp.json')}

    cfgBtn.addEventListener('click',function(){
      setLoading(cfgBtn,true);
      var targetPath=pathInput.value.trim()||undefined;
      showFeedback(cfgFeedback,'pending','正在配置...');
      statusDot.className='status-dot warn';
      vscodeApi.postMessage({command:'configureWorkspace',path:targetPath,sessionOrder:sessionOrder.slice()});
    });
    if(cleanupArtifactsBtn) cleanupArtifactsBtn.addEventListener('click',function(){
      setLoading(cleanupArtifactsBtn,true);
      showFeedback(cfgFeedback,'pending','正在清理卸载痕迹...');
      vscodeApi.postMessage({command:'cleanupArtifacts'});
    });

    sendBtn.addEventListener('click',sendMessage);

    // ── keyboard ──
    function onComposerInput(){
      updateComposerEmptyClass();setDraftValue(activeSessionId,msgInput.innerHTML);persistDraftsSoon();
    }
    msgInput.addEventListener('keydown',function(e){
      if((e.metaKey||e.ctrlKey)&&e.key==='Enter'){e.preventDefault();sendMessage();return}
    });
    msgInput.addEventListener('input',onComposerInput);
    msgInput.addEventListener('focus',updateComposerEmptyClass);
    msgInput.addEventListener('blur',updateComposerEmptyClass);

    // ── voice ──
    var activeSpeechRec=null;var voiceBaseText='';var voiceAccumulated='';var voiceNativePending=false;
    function setVoiceNativeBusy(busy){
      voiceNativePending=busy;if(!voiceInputBtn)return;
      if(busy){voiceInputBtn.classList.add('listening');voiceInputBtn.setAttribute('aria-pressed','true');voiceInputBtn.disabled=true}
      else{voiceInputBtn.classList.remove('listening');voiceInputBtn.setAttribute('aria-pressed','false');voiceInputBtn.disabled=false}
    }
    function stopVoiceInput(){
      if(activeSpeechRec){try{activeSpeechRec.stop()}catch(e){}activeSpeechRec=null}
      if(voiceInputBtn){voiceInputBtn.classList.remove('listening');voiceInputBtn.setAttribute('aria-pressed','false')}
    }
    function initVoiceInput(){
      if(!voiceInputBtn||!msgInput)return;
      if(VOICE_USE_WIN_NATIVE){
        voiceInputBtn.title='语音输入（Windows 系统识别）';
      voiceInputBtn.addEventListener('click',function(){
        if(voiceNativePending)return;setVoiceNativeBusy(true);
        showFeedback(sendFeedback,'pending','正在听写…');
        vscodeApi.postMessage({command:'voiceInputNative'});
      });return;
      }
      var SR=window.SpeechRecognition||window.webkitSpeechRecognition;
      if(!SR){voiceInputBtn.disabled=true;voiceInputBtn.title='当前环境不支持语音输入';return}
      voiceInputBtn.title='语音输入（再点一次结束）';
      voiceInputBtn.addEventListener('click',function(){
        if(activeSpeechRec){stopVoiceInput();return}
        var Rec=window.SpeechRecognition||window.webkitSpeechRecognition;
        if(!Rec){showFeedback(sendFeedback,'error','当前环境不支持语音输入');return}
        var rec=new Rec();rec.lang='zh-CN';rec.continuous=true;rec.interimResults=true;
        voiceBaseText=msgInput.innerHTML;voiceAccumulated='';
        rec.onstart=function(){voiceInputBtn.classList.add('listening');voiceInputBtn.setAttribute('aria-pressed','true');showFeedback(sendFeedback,'info','正在聆听…')};
        rec.onresult=function(event){var interim='';for(var i=event.resultIndex;i<event.results.length;i++){var r=event.results[i];var t=r[0]?r[0].transcript:'';if(r.isFinal)voiceAccumulated+=t;else interim+=t}msgInput.innerHTML=voiceBaseText;msgInput.appendChild(document.createTextNode(voiceAccumulated+interim));updateComposerEmptyClass();setDraftValue(activeSessionId,msgInput.innerHTML);persistDraftsSoon()};
        rec.onerror=function(ev){var err=ev.error||'';if(err==='not-allowed')showFeedback(sendFeedback,'error','语音输入暂不可用：侧栏环境无麦克风权限，请直接打字输入');else if(err!=='aborted'&&err!=='no-speech')showFeedback(sendFeedback,'error','语音识别出错：'+err);stopVoiceInput()};
        rec.onend=function(){activeSpeechRec=null;if(voiceInputBtn){voiceInputBtn.classList.remove('listening');voiceInputBtn.setAttribute('aria-pressed','false')}};
        try{activeSpeechRec=rec;rec.start()}catch(e){activeSpeechRec=null;showFeedback(sendFeedback,'error','无法启动语音识别')}
      });
    }
    initVoiceInput();

    // ── image preview & chips ──
    function closeImgPreview(){
      if(!imgPreviewOverlay)return;
      imgPreviewOverlay.classList.remove('visible');
      imgPreviewOverlay.setAttribute('aria-hidden','true');
      if(imgPreviewFull) imgPreviewFull.removeAttribute('src');
    }
    function openImgPreview(id){
      if(!imgPreviewFull||!imgPreviewOverlay)return;
      var pa=getPending();
      var a=pa.find(function(x){return String(x.id)===String(id)});
      if(!a||!a.data||!a.mimeType||String(a.mimeType).indexOf('image/')!==0)return;
      imgPreviewFull.src='data:'+a.mimeType+';base64,'+a.data;
      imgPreviewFull.alt=String(a.name||'');
      imgPreviewOverlay.classList.add('visible');
      imgPreviewOverlay.setAttribute('aria-hidden','false');
    }
    function renderAttachChips(){
      if(!attachChips)return;
      var pa=getPending().filter(function(a){return !a.hideInChips});
      attachChips.innerHTML=pa.map(function(a){
        var isImg=a.mimeType&&String(a.mimeType).indexOf('image/')===0&&a.data;
        if(isImg){
          var src='data:'+a.mimeType+';base64,'+a.data;
          return '<span class="chip chip-img">'+
            '<button type="button" class="chip-thumb" data-preview="'+escapeHtml(String(a.id))+'" title="'+escapeHtml(a.name)+'">'+
            '<img src="'+src+'" alt="" /></button>'+
            '<span class="chip-name" title="'+escapeHtml(a.name)+'">'+escapeHtml(a.name)+'</span>'+
            '<button type="button" class="rm" data-rm="'+a.id+'" title="移除">\u00d7</button></span>';
        }
        return '<span class="chip"><span title="'+escapeHtml(a.name)+'">'+escapeHtml(a.name)+'</span>'+
          '<button type="button" class="rm" data-rm="'+a.id+'" title="移除">\u00d7</button></span>';
      }).join('');
    }
    if(attachChips) attachChips.addEventListener('click',function(e){
      var t=e.target;if(!t||!t.closest)return;
      var rm=t.closest('.rm');
      if(rm){
        var rid=rm.getAttribute('data-rm');if(rid==null)return;
        e.preventDefault();e.stopPropagation();
        var pa=getPending();var idx=pa.findIndex(function(x){return String(x.id)===String(rid)});
        if(idx>=0) pa.splice(idx,1);renderAttachChips();
        return;
      }
      var thumb=t.closest('.chip-thumb');
      if(thumb){
        e.preventDefault();
        var pv=thumb.getAttribute('data-preview');if(pv!=null) openImgPreview(pv);
      }
    });
    if(imgPreviewBackdrop) imgPreviewBackdrop.addEventListener('click',closeImgPreview);
    document.addEventListener('keydown',function(e){
      if(e.key!=='Escape')return;
      if(imgPreviewOverlay&&imgPreviewOverlay.classList.contains('visible')){e.preventDefault();closeImgPreview();}
    });

    // ── image attachment ──
    function queueAttachmentFromFile(file,targetSessionId,nameHint,kindHint){
      var reader=new FileReader();
      reader.onload=function(){
        var result=reader.result;if(typeof result!=='string')return;
        var comma=result.indexOf(',');var data=comma>=0?result.slice(comma+1):result;
        var mimeType=file.type||'image/png';
        var kind=kindHint||(mimeType.indexOf('image/')===0?'image':'file');
        ensureSessionStructures(targetSessionId);
        pendingBySession[targetSessionId].push({id:Date.now()+Math.random(),name:nameHint||file.name||(kind==='image'?'image':'file'),mimeType:mimeType,data:data,kind:kind});
        if(targetSessionId===activeSessionId) renderAttachChips();
      };reader.readAsDataURL(file);
    }

    // ── paste ──
    function pushImageFromBlob(blob,nameHint,targetSessionId){
      var est=estimateBase64CharsFromBytes(blob&&blob.size);
      if(getPendingBase64Chars(targetSessionId)+est>MAX_ATTACH_BASE64_TOTAL){showFeedback(sendFeedback,'error',describeAttachmentLimit());return}
      var mt=blob.type||'image/png';var ext='png';
      if(mt.indexOf('jpeg')>=0||mt.indexOf('jpg')>=0)ext='jpg';else if(mt.indexOf('gif')>=0)ext='gif';else if(mt.indexOf('webp')>=0)ext='webp';
      queueAttachmentFromFile(blob,targetSessionId,nameHint||('粘贴-'+Date.now()+'.'+ext),'image');
    }
    msgInput.addEventListener('paste',function(e){
      var cd=e.clipboardData;if(!cd)return;var found=false;var tid=activeSessionId;var pc=getPendingBase64Chars(tid);
      if(cd.files&&cd.files.length){
        for(var fi=0;fi<cd.files.length;fi++){var f=cd.files[fi];
          if(f.type&&f.type.indexOf('image/')===0){var est=estimateBase64CharsFromBytes(f&&f.size);
            if(pc+est>MAX_ATTACH_BASE64_TOTAL){showFeedback(sendFeedback,'error',describeAttachmentLimit());break}
            e.preventDefault();found=true;pc+=est;pushImageFromBlob(f,f.name||null,tid)}}
      }
      if(!found&&cd.items){
        for(var ii=0;ii<cd.items.length;ii++){var item=cd.items[ii];
          if(item.type&&item.type.indexOf('image/')===0){e.preventDefault();var file=item.getAsFile();
            if(file){var ic=estimateBase64CharsFromBytes(file.size);if(pc+ic>MAX_ATTACH_BASE64_TOTAL){showFeedback(sendFeedback,'error',describeAttachmentLimit());break}pushImageFromBlob(file,null,tid)}break}}
      }
    });

    function sendMessage(){
      if(voiceNativePending){showFeedback(sendFeedback,'error','请等待语音识别结束');return}
      stopVoiceInput();
      var text=getComposerPlainTextForSend(msgInput).trim();
      var pa=getPending();
      var images=pa.filter(function(a){return a.kind==='image'}).map(function(a){return{mimeType:a.mimeType,data:a.data}});
      if(!text&&images.length===0){showFeedback(sendFeedback,'error','请输入文字或粘贴图片');return}
      var workspacePath=currentWorkspacePath||pathInput.value.trim();
      setLoading(sendBtn,true);showFeedback(sendFeedback,'pending','正在发送...');
      vscodeApi.postMessage({command:'sendMessage',text:text,workspacePath:workspacePath,images:images,sessionId:activeSessionId});
    }

    // ── message handler ──
    window.addEventListener('message',function(event){
      var msg=event.data;if(!msg||!msg.command)return;
      switch(msg.command){
        case 'copyPhraseResult':if(msg.ok)showFeedback(sendFeedback,'success','已复制');break;
        case 'sessionDeleted':if(!msg.ok)showFeedback(sendFeedback,'error','清空失败：'+(msg.msg||''));break;
        case 'folderSelected':
          if(msg.path){pathInput.value=msg.path;if(!currentWorkspacePath)updateCurrentPathDisplay(msg.path,false);persistWorkspacePathSoon();showFeedback(cfgFeedback,'info',(msg.fromCurrentWorkspace?'当前工作区：':'已选择：')+msg.path)}
          else if(msg.error){showFeedback(cfgFeedback,'error',String(msg.error))}break;
        case 'configResult':
          setLoading(cfgBtn,false);
          if(msg.ok){
            currentWorkspacePath=msg.workspacePath||'';
            if(pathInput&&currentWorkspacePath)pathInput.value=currentWorkspacePath;
            updateCurrentPathDisplay(currentWorkspacePath,!!currentWorkspacePath);
            if(!msg.silent) showFeedback(cfgFeedback,'success',msg.msg);
            statusDot.className='status-dot ok';
            addMessage('system','配置成功，MCP 已就绪\\n'+currentWorkspacePath);
            if(configDetails)configDetails.removeAttribute('open');
          }else{
            showFeedback(cfgFeedback,'error','配置失败：'+msg.msg);statusDot.className='status-dot err';
            if(configDetails)configDetails.setAttribute('open','');
          }break;
        case 'cleanupArtifactsResult':
          if(cleanupArtifactsBtn) setLoading(cleanupArtifactsBtn,false);
          if(msg.ok){
            showFeedback(cfgFeedback,'success',msg.msg||'已清理完成');
            if(configDetails)configDetails.setAttribute('open','');
          }else{
            showFeedback(cfgFeedback,'error','清理失败：'+(msg.msg||''));
          }break;
        case 'restoreSessionOrder':
          if(Array.isArray(msg.order)&&msg.order.length){
            sessionOrder=msg.order.map(String).filter(function(id){var n=parseInt(id,10);return n>=1&&n<=MAX_SESSIONS&&String(n)===id});
            if(sessionOrder.length===0)sessionOrder=['1','2','3'];
            var seen={};sessionOrder=sessionOrder.filter(function(id){if(seen[id])return false;seen[id]=true;return true});
            if(sessionOrder.indexOf(activeSessionId)<0)activeSessionId=sessionOrder[0];
            sessionOrder.forEach(function(s){ensureSessionStructures(s)});
            renderSessionTabs();if(msgInput)setComposerHtml(activeSessionId,getDraftValue(activeSessionId));renderAttachChips();renderMessages();
          }break;
        case 'restoreSessionMemos':
          if(msg.memos&&typeof msg.memos==='object'){
            Object.keys(msg.memos).forEach(function(k){var raw=msg.memos[k];if(raw==null)return;var t=String(raw).trim().slice(0,200);if(t)sessionMemos[k]=t});
            if(sessionMemoInput)sessionMemoInput.value=sessionMemos[activeSessionId]||'';
            renderSessionTabs();
          }break;
        case 'restoreWorkspacePath':
          if(typeof msg.path==='string'&&msg.path.trim()){var rp=msg.path.trim();pathInput.value=rp;if(!currentWorkspacePath)updateCurrentPathDisplay(rp,false)}
          else updateCurrentPathDisplay(currentWorkspacePath,!!currentWorkspacePath);break;
        case 'restorePresets':
          if(msg.presets&&typeof msg.presets==='object'){
            Object.keys(msg.presets).forEach(function(k){
              if(!Array.isArray(msg.presets[k]))return;
              setPresets(k,msg.presets[k]);
            });
            renderPresetsBar();renderPresetsConfig();
          }break;
        case 'restoreDrafts':
          if(msg.drafts&&typeof msg.drafts==='object'){Object.keys(msg.drafts).forEach(function(k){var raw=msg.drafts[k];if(raw==null)return;setDraftValue(k,String(raw))});if(msgInput)setComposerHtml(activeSessionId,getDraftValue(activeSessionId))}break;
        case 'restoreHistories':
          try{var data=JSON.parse(msg.payload||'{}');Object.keys(data).forEach(function(sid){if(!Array.isArray(data[sid]))return;ensureSessionStructures(sid);messagesBySession[sid]=trimSessionMessages(data[sid].map(function(row){return{type:normalizeMessageType(row&&row.type),content:String(row&&row.content!=null?row.content:''),time:row&&row.time?new Date(row.time):new Date()}}))});renderMessages()}catch(e){}break;
        case 'sessionRuntimeStatus':
          if(msg.payload&&typeof msg.payload==='object'&&msg.payload.sessionId){
            var rsid=String(msg.payload.sessionId);ensureSessionStructures(rsid);
            runtimeBySession[rsid]={state:String(msg.payload.state||'idle'),queueSize:Number(msg.payload.queueSize||0),heartbeatAt:String(msg.payload.heartbeatAt||''),aiDoneAt:String(msg.payload.aiDoneAt||''),replyAt:String(msg.payload.replyAt||''),lastMessageAt:String(msg.payload.lastMessageAt||''),heartbeatFresh:!!msg.payload.heartbeatFresh};
            if(rsid===activeSessionId) renderHintStatus();
          }break;
        case 'voiceInputResult':
          setVoiceNativeBusy(false);
          if(msg.ok){var vt=String(msg.text||'').trim();if(vt){msgInput.appendChild(document.createTextNode((msgInput.textContent&&!/\\s$/.test(msgInput.textContent)?' ':'')+vt));updateComposerEmptyClass();setDraftValue(activeSessionId,msgInput.innerHTML);persistDraftsSoon();showFeedback(sendFeedback,'success','已写入语音结果')}else showFeedback(sendFeedback,'info','未获得有效文字')}
          else showFeedback(sendFeedback,'error',msg.msg||'语音识别失败');break;
        case 'sendResult':
          setLoading(sendBtn,false);
          if(msg.ok){var sid=msg.sessionId||activeSessionId;ensureSessionStructures(sid);
            nextStepsBySession[sid]=null;
            runtimeBySession[sid].state='queued';runtimeBySession[sid].queueSize=(runtimeBySession[sid].queueSize||0)+1;runtimeBySession[sid].lastMessageAt='';runtimeBySession[sid].replyAt='';
            if(sid===activeSessionId)renderHintStatus();
            var line=msg.text||getComposerPlainTextForSend(msgInput).trim();
            var imgCount=msg.imageCount||0;
            if(imgCount>0){var imgTag='[图片 x'+imgCount+']';line=line?(line+'\\n'+imgTag):imgTag}
            addMessage('user',line,undefined,sid);setDraftValue(sid,'');persistDraftsSoon();
            pendingBySession[sid]=[];renderAttachChips();
            if(sid===activeSessionId){msgInput.innerHTML='';updateComposerEmptyClass()}else setComposerHtml(activeSessionId,getDraftValue(activeSessionId));
            showFeedback(sendFeedback,'success',msg.msg);
          }else showFeedback(sendFeedback,'error','发送失败：'+msg.msg);break;
        case 'cursorReply':
          if(msg.reply||msg.suggestions){var rsid2=msg.sessionId||activeSessionId;ensureSessionStructures(rsid2);
            runtimeBySession[rsid2].state='connected';runtimeBySession[rsid2].queueSize=0;runtimeBySession[rsid2].replyAt=String(msg.time||'');runtimeBySession[rsid2].heartbeatAt=String(msg.time||runtimeBySession[rsid2].heartbeatAt||'');
            if(msg.reply) addMessage('cursor',msg.reply,msg.time,rsid2);
            statusDot.className='status-dot ok';
            if(Array.isArray(msg.suggestions)&&msg.suggestions.length>0){
              nextStepsBySession[rsid2]=msg.suggestions;
            }else{
              nextStepsBySession[rsid2]=null;
            }
            if(rsid2===activeSessionId){renderHintStatus();renderNextSteps()}
          }break;
        case 'pong':addMessage('system','pong: '+msg.text);break;
      }
    });
    renderMessages();
    updateConnectionBanner();`;
    return body
        .replace(/<<<__SC_VOICE__>>>/g, platform === "win32" ? "true" : "false")
        .replace(/<<<__SC_MAX_SESSIONS__>>>/g, String(maxSessions))
        .replace(/<<<__SC_MAX_HIST__>>>/g, String(MAX_SESSION_HISTORY_ITEMS))
        .replace(/<<<__SC_MAX_ATTACH__>>>/g, String(MAX_ATTACH_BASE64_CHARS))
;
}

exports.getScript = getScript;
