export function operationsKey(exhibition:number,section:string,day:string,status:string,buyer:string,exhibitor:string,page:number):string {
 return JSON.stringify([exhibition,section,day,status,buyer,exhibitor,page]);
}
export function currentOperations<T>(key:string,loaded:{key:string;value:T}|null):T|null {
 return loaded?.key===key?loaded.value:null;
}
