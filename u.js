class qu{
    constructor(m){
        this.size = m
        this.csize = 0;
        this.head = 0;
        this.tail = 0;
        this.arr = new Array(this.size);
        this.arr.fill(0,0,this.size);
        Object.seal(this.arr);

        this.swtch = false;
    }

    get csize () {
        return this._csize;
    }

    set csize(value){
        this._csize = value;
    }

    getswt=()=>{
        return this.swtch;
    }

    swt=()=>{
        this.swtch = !this.swtch;
    }

    add=(m)=>{
        this.swt();

        if(this.full()){
            this.swt();
            return 0;
        }
        else if(!this.empty()){
            this.tail += 1;
            this.tail = this.tail === this.size ? 0 : this.tail;    
        }
        
        this.arr[this.tail] = m;
        this.csize += 1;

        this.swt();
        return 1;
    }

    remove=()=>{
        if(this.empty()){
            this.swt();
                return null;
            }
        let fst = this.arr[this.head];

        if(this.csize > 1)
            this.head = this.head + 1 === this.size ? 0 : this.head + 1;
    
        this.csize -= 1;

        this.swt();
        return fst;
    }

    full=()=>{
        return this.csize === this.size;
    }

    empty=()=>{
        return this.csize === 0;
    }

    spread=()=>{
        let res = new Array(this.csize);
        let a = this.head;
        for(let c=0; c < this.csize; ++c){
            res.push(this.arr[a]);
            a = a === this.size-1 ? 0 : a+1;
        }

        return res;
    }

    consume=(cb)=>{
        let a = this.head;
        let sz = this.csize;
        for(let c=0; c < sz; ++c){
            cb(this.remove());
        }
    }
}

module.exports=qu;