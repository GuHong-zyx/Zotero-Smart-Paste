import {Schema,DOMParser,DOMSerializer} from 'prosemirror-model';
import {EditorState} from 'prosemirror-state';
import {EditorView} from 'prosemirror-view';
import {schema} from '../../research/note-editor/src/core/schema/index.js';
import {dropPaste} from '../../research/note-editor/src/core/plugins/drop-paste.js';
window.verifyZoteroHTML=html=>{
  const root=document.createElement('div');root.innerHTML=html;
  const parsed=DOMParser.fromSchema(schema).parse(root);
  const roundtrip=document.createElement('div');roundtrip.append(DOMSerializer.fromSchema(schema).serializeFragment(parsed.content));
  return {json:parsed.toJSON(),html:roundtrip.innerHTML};
};
window.makeZoteroTestEditor=()=>{
  document.getElementById('test-editor')?.remove();
  const host=document.createElement('div');host.id='test-editor';document.body.append(host);
  const view=new EditorView(host,{state:EditorState.create({schema,plugins:[dropPaste({ignoreImages:true})]})});
  window.testEditor=view;view.focus();return true;
};
