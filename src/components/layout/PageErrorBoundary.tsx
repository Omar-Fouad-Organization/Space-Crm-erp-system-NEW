import React from 'react';
import {Button} from '@/components/ui/button';
import {Card, CardContent} from '@/components/ui/card';
export class PageErrorBoundary extends React.Component<{children:React.ReactNode},{error:string}> {
  state={error:''};
  static getDerivedStateFromError(error:Error){return {error:error.message};}
  render(){return this.state.error?<Card><CardContent className="p-6 space-y-4"><h1 className="text-xl font-semibold">This page could not load</h1><p role="alert">{this.state.error}</p><Button onClick={()=>this.setState({error:''})}>Retry Page</Button></CardContent></Card>:this.props.children;}
}
