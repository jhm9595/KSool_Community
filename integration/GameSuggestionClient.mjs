/** Standalone adapter. Import this in a future game integration; never edits the game. */
export class GameSuggestionClient {
  constructor(baseURL,{inventory=null,fetcher=fetch}={}){this.baseURL=baseURL.replace(/\/$/,'');this.inventory=inventory;this.fetcher=fetcher;this.suggestions=[];this.userVotes={};}
  async request(path,options={}){const response=await this.fetcher(this.baseURL+'/api'+path,{credentials:'include',...options,headers:{'Content-Type':'application/json',...options.headers}});const result=await response.json();if(!response.ok)throw new Error(result.error||'API error');return result;}
  async init(){await this.request('/session');return this.sync();}
  async sync(){let before=null;const list=[],votes={};do{const data=await this.request('/suggestions'+(before?'?before='+encodeURIComponent(before):''));list.push(...data.suggestions);Object.assign(votes,data.userVotes);before=data.nextBefore;}while(before);this.suggestions=list;this.userVotes=votes;return {suggestions:list,userVotes:votes};}
  getActiveSuggestions(){return this.suggestions.filter(s=>!s.is_applied&&(!this.inventory||s.items.every(i=>this.inventory.isIngredientAvailable(i.ingredient_id)))).sort((a,b)=>(b.upvotes-b.downvotes)-(a.upvotes-a.downvotes));}
  async submitFromPot(potSlots){const result=await this.request('/suggestions',{method:'POST',body:JSON.stringify({potSlots})});await this.sync();return {ok:true,suggestion:result};}
  async vote(suggestionKey,type){const result=await this.request('/votes',{method:'PUT',body:JSON.stringify({suggestion_key:suggestionKey,type})});await this.sync();return result;}
  exportGameSnapshot(){return {suggestions:this.suggestions.map(({suggestion_key,items,upvotes,downvotes,is_applied})=>({suggestion_key,items,upvotes,downvotes,is_applied})),userVotes:{...this.userVotes}};}
}
