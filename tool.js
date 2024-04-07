const path = require('path')
const fs = require('fs')

class Base64String{
    constructor(n=0){
        this.data = "0"
        this.setByBase10(n)
    }

    _base64StringArrAdd0AtBegin(stringArr){
        let re = ['0']
        for(let i=0;i<stringArr.length;i++){
            re.push(stringArr[i])
        }
        return re
    }

    _base64StringCompare(baseString1,baseString2){
    
        if(string1.length<string2.length){
            return -1
        }
        if(string1.length>string2.length){
            return 1
        }
        for(let i=0;i<string1.length;i++){
            if(string1.slice(i,i+1).charCodeAt(0)<string2.slice(i,i+1).charCodeAt(0)){
                return -1
            }
            if(string1.slice(i,i+1).charCodeAt(0)>string2.slice(i,i+1).charCodeAt(0)){
                return 1
            }
        }
        return 0
    }

    _base64StringAdd1(string){
        string = string.split('')
        let flag = true
        let index = string.length - 1
        while (flag==true) {
            if(string[index]=='β'){
                string[index]='0'
                index-=1
                if(index==-1){
                    index=0
                    string = this._base64StringArrAdd0AtBegin(string)
                }
            }else{
                string[index] = String.fromCharCode(string[index].charCodeAt(0) + 1)
                if(string[index] == String.fromCharCode(58)){
                    string[index] = 'A'
                    flag = false
                }
                if(string[index] == String.fromCharCode(91)){
                    string[index] = 'a'
                    flag = false
                }
                if(string[index] == String.fromCharCode(123)){
                    string[index] = 'α'
                    flag = false
                }
                flag = false
            }
        }
        let re = ''
        for(let i=0;i<string.length;i++){
            re+=string[i]
        }
        return re
    }

    add1(){
        let string = this.data
        string = string.split('')
        let flag = true
        let index = string.length - 1
        while (flag==true) {
            if(string[index]=='β'){
                string[index]='0'
                index-=1
                if(index==-1){
                    index=0
                    string = this._base64StringArrAdd0AtBegin(string)
                }
            }else{
                string[index] = String.fromCharCode(string[index].charCodeAt(0) + 1)
                if(string[index] == String.fromCharCode(58)){
                    string[index] = 'A'
                    flag = false
                }
                if(string[index] == String.fromCharCode(91)){
                    string[index] = 'a'
                    flag = false
                }
                if(string[index] == String.fromCharCode(123)){
                    string[index] = 'α'
                    flag = false
                }
                flag = false
            }
        }
        let re = ''
        for(let i=0;i<string.length;i++){
            re+=string[i]
        }
        this.data = re
    }

    sub1(){
        let string = this.data
        let re = "0"
        let last = ""
        while (this._base64StringCompare(re,string)) {
            last = re
            re = this._base64StringAdd1(re)
        }
        this.data = re
    }

    setByBase10(n){
        this.data = "0"
        for(let i=0;i<n;i++){
            this.add1()
        }
    }

    setByBase64(string){
        this.data = string
    }

    get(){
        return this.data
    }

    getBase10(){
        let re = 0
        let c = "0"
        while(c!=this.data){
            re+=1
            c = this._base64StringAdd1(c)
        }
        return re
    }
}

module.exports = {
    isJSONString(str) {
        try {
          JSON.parse(str);
          return true;
        } catch (e) {
          return false;
        }
    },
    Base64String,
    base64StringCompare(string1,string2){
        if(string1.length<string2.length){
            return -1
        }
        if(string1.length>string2.length){
            return 1
        }
        for(let i=0;i<string1.length;i++){
            if(string1.slice(i,i+1).charCodeAt(0)<string2.slice(i,i+1).charCodeAt(0)){
                return -1
            }
            if(string1.slice(i,i+1).charCodeAt(0)>string2.slice(i,i+1).charCodeAt(0)){
                return 1
            }
        }
        return 0
    },
    quickSort(arr, compareFunction) {
      if (arr.length <= 1) {
        return arr;
      }
    
      const pivotIndex = Math.floor(arr.length / 2);
      const pivot = arr[pivotIndex];
    
      const smaller = [];
      const equal = [];
      const larger = [];
    
      for (let i = 0; i < arr.length; i++) {
        const result = compareFunction(arr[i], pivot);
        if (result < 0) {
          smaller.push(arr[i]);
        } else if (result === 0) {
          equal.push(arr[i]);
        } else {
          larger.push(arr[i]);
        }
      }
    
      return quickSort(smaller, compareFunction).concat(equal, quickSort(larger, compareFunction));
    },
    isVaildPasswordString(password){
        if(password.length<8 || password>length>16){
            return false
        }
        password = password.split('')
        let flags = [false,false,false]
        for(let i=0;i<password.length;i++){
            let x = password[i].charCodeAt(0)
            if(x>=48 && x<=57){
                flags[0] = true
                continue
            }
            if(x>=65 && x<=90){
                flags[1] = true
                continue
            }
            if(x>=97 && x<=122){
                flags[2] = true
                continue
            }
            return false
        }
        if(flags[0]==false || flags[1]==false || flags[2]==false){
            return false
        }
        return true
    },
    encodeString(string){
        string = string.split('')
        let string1 = ''
        for(let i=0;i<string.length;i++){
            string1 += JSON.stringify(JSON.stringify(string[i].charCodeAt(0)).length) + JSON.stringify(string[i].charCodeAt(0))
        }
        string1 = string1.split('')
        for(let i=0;i<string1.length;i++){
            if(string1[i]=='0'){
                continue
            }
            let c = i
            let ss = string1[c]
            while (true) {
                let cd = this.isLetter(parseInt(ss))
                if(cd==2){
                    break
                }
                if(cd==1){
                    string1[c] = String.fromCharCode(parseInt(ss))
                    for(let i1=i;i1<c;i1++){
                        string1[i1] = '-'
                    }
                    i = c
                    break
                }
                c++
                if(c==string1.length){
                    break
                }
                ss+=string1[c]
            }
        }
        for(let i=0;i<string1.length-1;i++){
            if(string1[i]=='2' && string1[i+1]=='2'){
                string1[i]='?'
                string1[i+1] = '-'
            }
        }
        let string2 = []
        for(let i=0;i<string1.length;i++){
            if(string1[i]=='-'){
                continue
            }
            string2.push(JSON.stringify((string1[i].charCodeAt(0) - string1[i].charCodeAt(0)%52)/52) + getNumberString(string1[i].charCodeAt(0)%52,2))
        }
        let string3 = ''
        for(let i = string2.length-1;i>=0;i--){
            string3 += string2[i]
        }
        string3 = string3.split('')
        let string4 = []
        for(let i=0;i<string3.length;i+=2){
            let ch = string3[i]
            if(i+1!=string3.length){
                ch+=string3[i+1]
            }
            if(parseInt(ch)<52 && ch.length==2){
                if(parseInt(ch)<26){
                    string4.push(String.fromCharCode(parseInt(ch) + 65))
                }else{
                    string4.push(String.fromCharCode(parseInt(ch) + 97 - 26))
                }
            }else{
                string4.push(ch)
            }
        }
        let string5 = ''
        for(let i=0;i<string4.length;i++){
            string5+=string4[i]
        }
        return string5
    },
    decodeString(string){
        string = string.split('')
        for(let i=0;i<string.length;i++){
            if(string[i].charCodeAt(0)>=48 && string[i].charCodeAt(0)<=56){
                continue
            }
            if(string[i].charCodeAt(0)<=90){
                string[i] = getNumberString(string[i].charCodeAt(0) - 65,2)
            }else{
                string[i] = getNumberString(string[i].charCodeAt(0) - 97 + 26,2)
            }
        }
        let string2 = ''
        for(let i=0;i<string.length;i++){
            if(string[i]=='-8'){
                string2+='9'
                continue
            }
            string2+=string[i]
        }
        string2 = string2.split('')
        let string3 = []
        for(let i=0;i<string2.length;i+=3){
            string3.push(getNumberString(parseInt(string2[i])*52 + parseInt(string2[i+1] + string2[i+2]),3))
        }
        let string4 = []
        for(let i=string3.length-1;i>=0;i--){
            string4.push(String.fromCharCode(parseInt(string3[i])))
        }
        let string5 = ''
        for(let i=0;i<string4.length;i++){
            if(string4[i]=='?'){
                string5+='22'
                continue
            }
            if((string4[i].charCodeAt(0)>=48 && string4[i].charCodeAt(0)<=57)==false){
                string5+=JSON.stringify(string4[i].charCodeAt(0))
                continue
            }
            string5+=string4[i]
        }
        string5 = string5.split('')
        let string6 = ''
        for(let i=0;i<string5.length;i++){
            let n = parseInt(string5[i])
            let s = ''
            for(let i1=0;i1<n;i1++){
                s+=string5[i+1+i1]
            }
            string6+=String.fromCharCode(parseInt(s))
            i+=n
        }
        return string6
    },
    getCurrentTimeString(){
        let currentTime = new Date
        let re = ''
        re += getFullLengthNumber(currentTime.getFullYear(),4)
        re += getFullLengthNumber(currentTime.getMonth()+1,2)
        re += getFullLengthNumber(currentTime.getDate(),2)
        re += getFullLengthNumber(currentTime.getHours(),2)
        re += getFullLengthNumber(currentTime.getMinutes(),2)
        re += getFullLengthNumber(currentTime.getSeconds(),2)
        return re
    },
    isLetter(code){
        if(code>=65 && code<=90){
            return 1
        }
        if(code>=97 && code<=122){
            return 1
        }
        if(code>90 && code<97){
            return 2
        }
        if(code<65){
            return 0
        }
        return 2
    },
    getCurrentTimeString(){
        let currentTime = new Date
        let re = ''
        re += getFullLengthNumber(currentTime.getFullYear(),4)
        re += getFullLengthNumber(currentTime.getMonth()+1,2)
        re += getFullLengthNumber(currentTime.getDate(),2)
        re += getFullLengthNumber(currentTime.getHours(),2)
        re += getFullLengthNumber(currentTime.getMinutes(),2)
        re += getFullLengthNumber(currentTime.getSeconds(),2)
        return re
    },
    isRightEmailAddress(string){
        if(isIncludeSpace(string)){
            return false
        }
        if(isAStringOfUppercaseAndLowercaseLettersAndNumbers(string)==false){
            return false
        }
        string = string.split('@')
        if(string.length!=2){
            return false
        }
        if(string[0]=='' || string[1]==''){
            return false
        }
        return true
    },
    deleteArrayElemByIndex(arr,index){
        let re = []
        for(let i=0;i<arr.length;i++){
            if(i==index)continue
            re.push(arr[i])
        }
        return re
    },
    getDifferenceOfTheTimeString(timeString1,timeString2){
        let t1 = getTimeStringPart(timeString1,'year') * getYearSecond(isLeapYear(getTimeStringPart(timeString1,'year'))) + 
        getTimeStringPart(timeString1,'month') * getMonthSecond(getTimeStringPart(timeString1,'month'),isLeapYear(getTimeStringPart(timeString1,'year'))) + 
        getTimeStringPart(timeString1,'day') * getDaySecond() + 
        getTimeStringPart(timeString1,'hour') * 60 * 60 +
        getTimeStringPart(timeString1,'minute') * 60 + 
        getTimeStringPart(timeString1,'second')
        let t2 = getTimeStringPart(timeString2,'year') * getYearSecond(isLeapYear(getTimeStringPart(timeString2,'year'))) + 
        getTimeStringPart(timeString2,'month') * getMonthSecond(getTimeStringPart(timeString2,'month'),isLeapYear(getTimeStringPart(timeString2,'year'))) + 
        getTimeStringPart(timeString2,'day') * getDaySecond() + 
        getTimeStringPart(timeString2,'hour') * 60 * 60 +
        getTimeStringPart(timeString2,'minute') * 60 + 
        getTimeStringPart(timeString2,'second')
        return t1-t2
    },
    getCurrentYearMonthDayString(){
        let currentTime = new Date
        let re = ''
        re += getFullLengthNumber(currentTime.getFullYear(),4)
        re += getFullLengthNumber(currentTime.getMonth()+1,2)
        re += getFullLengthNumber(currentTime.getDate(),2)
        return re
    },
    getCurrentTimeReadableString(){
        let currentTime = new Date
        let re = ''
        re += getFullLengthNumber(currentTime.getFullYear(),4) + '/'
        re += getFullLengthNumber(currentTime.getMonth()+1,2) + '/'
        re += getFullLengthNumber(currentTime.getDate(),2) + ' '
        re += getFullLengthNumber(currentTime.getHours(),2) + ':'
        re += getFullLengthNumber(currentTime.getMinutes(),2) + ':'
        re += getFullLengthNumber(currentTime.getSeconds(),2) + ''
        return re
    },
    getCurrentTimeReadableString2(){
        let currentTime = new Date
        let re = ''
        re += getFullLengthNumber(currentTime.getFullYear(),4) + '_'
        re += getFullLengthNumber(currentTime.getMonth()+1,2) + '_'
        re += getFullLengthNumber(currentTime.getDate(),2) + '_'
        re += getFullLengthNumber(currentTime.getHours(),2) + '_'
        re += getFullLengthNumber(currentTime.getMinutes(),2) + '_'
        re += getFullLengthNumber(currentTime.getSeconds(),2) + ''
        return re
    },
    getCurrentTimeConvertableString(){
        let currentTime = new Date
        let re = ''
        re += getFullLengthNumber(currentTime.getFullYear(),4) + '-'
        re += getFullLengthNumber(currentTime.getMonth()+1,2) + '-'
        re += getFullLengthNumber(currentTime.getDate(),2) + ' '
        re += getFullLengthNumber(currentTime.getHours(),2) + ':'
        re += getFullLengthNumber(currentTime.getMinutes(),2) + ':'
        re += getFullLengthNumber(currentTime.getSeconds(),2) + ''
        return re
    },
    isSubString(string1,string2){
        return string2.indexOf(string1)==-1?false:true
    },
    changeText(string){
        if(string==null){
            return ''
        }
        string = string.split('')
        for(let i=0;i<string.length;i++){
            if(string[i]==','){
                string[i] = '，'
            }
        }
        let re = ''
        for(let i=0;i<string.length;i++){
            re+=string[i]
        }
        return re
    },
    deleteJSONArrElemByKeyAndValue(arr,key,value){
        let re = []
        for(let i=0;i<arr.length;i++){
            if(arr[i][key]==value)continue
            re.push(arr[i])
        }
        return re
    },
    async waitSeconds(n){
        return new Promise((resolve, reject) => {
            setTimeout(()=>{
                return resolve()
            },n*1000)
        })
    },
    getCSVLineStringByArr(arr){
        let re = ""
        for(let i=0;i<arr.length;i++){
            if(re!=''){
                re+=','
            }
            if(arr[i]==undefined){
                arr[i]=='undefined'
            }
            if(arr[i].toString()=='NaN'){
                arr[i] = 0
            }
            if(typeof(arr[i])=='number'){
                re+=arr[i].toString()
            }else if(typeof(arr[i])=='object'){
                re+=JSON.stringify(arr[i])
                // re+=this.encodeString(JSON.stringify(arr[i]))
            }else{
                re+=arr[i]
            }
        }
        return re
    },
    arrElemParseInt(arr,parseIntIndexs){
        for(let i=0;i<parseIntIndexs.length;i++){
            arr[parseIntIndexs[i]] = parseInt(arr[parseIntIndexs[i]])
            if(isNaN(arr[parseIntIndexs[i]])){
                arr[parseIntIndexs[i]]=0
            }
        }
        return arr
    },
    arrElemToString(arr){
        for(let i=0;i<arr.length;i++){
            arr[i] = arr[i].toString()
            // arr[i] = this.replaceCommaWithHash(arr[i])
        }
        return arr
    },
    replaceCommaWithHash(string){
        string = string.split('')
        for(let i=0;i<string.length;i++){
            if(string[i]==','){
                string[i] = '#'
            }
        }
        let re = ''
        for(let i=0;i<string.length;i++){
            re+=string[i]
        }
        return re
    },
    createDataFile(content, fileName) {
        const folderPath = path.join(__dirname, 'dataFiles');
        const filePath = path.join(folderPath, `${fileName}.txt`);
      
        // 检查文件夹是否存在，若不存在则创建
        if (!fs.existsSync(folderPath)) {
          fs.mkdirSync(folderPath);
        }
      
        // 创建文件并写入内容
        fs.writeFileSync(filePath, content);
    },
    getAllDataFileNames() {
        const folderPath = path.join(__dirname, 'dataFiles');
        const fileNames = fs.readdirSync(folderPath);
        return fileNames;
    },
    deleteDataFile(fileNameWithoutExtension) {
        const folderPath = path.join(__dirname, 'dataFiles');
        const filePath = path.join(folderPath, fileNameWithoutExtension + '.txt');
      
        // 检查文件是否存在
        if (fs.existsSync(filePath)) {
          // 删除文件
          fs.unlinkSync(filePath);
        } else {
        }
    },
    getDataFileContent(fileName) {
        return new Promise((resolve, reject) => {
            const folderPath = path.join(__dirname, 'dataFiles');
            const filePath = path.join(folderPath, fileName + '.txt');
            fs.readFile(filePath, 'utf8', (err, data) => {
              if (err) {
                console.log(`读取文件失败：${fileName}`, err);
              } else {
                return resolve(data)
              }
            });
        })
        
    },
    sliceArr(arr,start,end){
        let re = []
        for(let i=start;i<end && i<arr.length;i++){
            re.push(arr[i])
        }
        return re
    },
    formatTime(seconds) {
      let days = Math.floor(seconds / (24 * 60 * 60));
      let hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
      let minutes = Math.floor((seconds % (60 * 60)) / 60);
      let remainingSeconds = seconds % 60;
    
      let formattedTime = '';
    
      if (days > 0) {
        formattedTime += `${days}天 `;
      }
      if (hours > 0) {
        formattedTime += `${hours}时`;
      }
      if (minutes > 0) {
        formattedTime += `${minutes}分`;
      }
      if (remainingSeconds > 0) {
        formattedTime += `${remainingSeconds}秒`;
      }
      return formattedTime.trim();
    },
    createFile(content, fileName) {
        const folderPath = path.join(__dirname, 'files');
        const filePath = path.join(folderPath, `${fileName}`);
        // 检查文件夹是否存在，若不存在则创建
        if (!fs.existsSync(folderPath)) {
          fs.mkdirSync(folderPath);
        }
        // 创建文件并写入内容
        fs.writeFileSync(filePath, content);
    },
    getSingleArrayByMark(arrays){
        function isExist(arr,mark){
            for(let i=0;i<arr.length;i++){
                if(arr[i].mark==mark){
                    return true
                }
            }
            return false
        }
        let re = arrays[0]
        for(let i=1;i<arrays.length;i++){
            for(let i1=0;i1<arrays[i].length;i1++){
                if(isExist(re,arrays[i][i1].mark)==false){
                    re.push(arrays[i][i1])
                }
            }
        }
        return re
    },
    getCurrentDateString(){
        let ct = new Date
        return ct.getFullYear().toString() + '-' + (ct.getMonth() + 1).toString() + '-' + ct.getDate().toString()
    },
    getCurrentTimeString(){
        let ct = new Date
        return ct.getHours().toString() + ':' + (ct.getMinutes()).toString() + ':' + ct.getSeconds().toString()
    },
    deleteStringArrayItem(item,arr){
        let re = []
        for(let i=0;i<arr.length;i++){
            if(arr[i]==item)continue
            re.push(arr[i])
        }
        return re
    },
    getResString(status=0,content='',results=undefined){
        return this.encodeString(JSON.stringify({
            status:status,
            content:content,
            results:results
        }))
    },
    resSend(res,status=0,content='',results=undefined){
        res.send(this.getResString(status,content,results))
    },
    formatTimeNew(inputTime = new Date()) {  
        function getPeriod(hours) {  
            if (hours >= 0 && hours < 6) {  
                return '凌晨';  
            } else if (hours >= 6 && hours < 11) {  
                return '上午';  
            } else if (hours >= 11 && hours < 14) {  
                return '中午';  
            } else if (hours >= 14 && hours < 18) {  
                return '下午';  
            } else {  
                return '晚上';  
            }  
        }  
        function getWeekName(n){
            switch (n) {
                case 0:
                    return '星期天'
                case 1:
                    return '星期一'
                case 2:
                    return '星期二'
                case 3:
                    return '星期三'
                case 4:
                    return '星期四'
                case 5:
                    return '星期五'
                case 6:
                    return '星期六'
            }
        }
        let currentTime = new Date()
        let oneDaySecond = 86400000
        let currentDayStart = new Date(currentTime.getTime() - currentTime.getHours()*60*60*1000 - currentTime.getMinutes()*60*1000 - currentTime.getSeconds()*1000)
        let lastDayStart = new Date(currentTime.getTime() - currentTime.getHours()*60*60*1000 - currentTime.getMinutes()*60*1000 - currentTime.getSeconds()*1000 - oneDaySecond)
        let nextDayStart = new Date(currentTime.getTime() - currentTime.getHours()*60*60*1000 - currentTime.getMinutes()*60*1000 - currentTime.getSeconds()*1000 + oneDaySecond)
        let nextDayEnd = new Date(currentTime.getTime() - currentTime.getHours()*60*60*1000 - currentTime.getMinutes()*60*1000 - currentTime.getSeconds()*1000 + oneDaySecond*2)
        let prefix = ''
        if(inputTime>= currentDayStart && inputTime<nextDayStart){
            prefix = '今天'
        }
        if(inputTime>= lastDayStart && inputTime<currentDayStart){
            prefix = '昨天'
        }
        if(inputTime>= nextDayStart && inputTime<nextDayEnd){
            prefix = '明天'
        }
        if(prefix==''){
            prefix = (inputTime.getFullYear()==currentTime.getFullYear()?'':inputTime.getFullYear().toString() + '年') + (inputTime.getMonth() + 1).toString() + '月' + inputTime.getDate() + '日 '
        }
        prefix += getPeriod(inputTime.getHours()) + ' '
        prefix += inputTime.getHours().toString() + ':'
        if(inputTime.getMinutes()<10){
            prefix+='0'
        }
        prefix += inputTime.getMinutes().toString() + ' '
        prefix += getWeekName(inputTime.getDay())
        return prefix
    },
    getJSONKeyValueArr(jsonArr,keyName){
        let re = []
        for(let i=0;i<jsonArr.length;i++){
            re.push(jsonArr[i][keyName])
        }
        return re
    },
    
}

function getDaySecond(){
    return 24 * 60 * 60
}

function getMonthSecond(month,isLeapYear){
    return getDayNumOfMonth(month,isLeapYear) * 24 * 60 * 60
}

function getYearSecond(isLeapYear){
    isLeapYear = isLeapYear?1:0
    return (31*7 + 30*4 + (28 + isLeapYear)) * 24 * 60 * 60
}

function getTimeStringPart(timeString,partName){
    switch (partName) {
        case 'year':
            return parseInt(timeString.slice(0,5))
        case 'month':
            return parseInt(timeString.slice(4,6))
        case 'day':
            return parseInt(timeString.slice(6,8))
        case 'hour':
            return parseInt(timeString.slice(8,10))
        case 'minute':
            return parseInt(timeString.slice(10,12))
        case 'second':
            return parseInt(timeString.slice(12,14))
        default:
            return undefined
    }
}

function getDayNumOfMonth(month,isLeapYear){
    if(month==1 || month==3 || month==5 || month==7 || month==8 || month==10 || month==12){
        return 31
    }
    if(month==2){
        if(isLeapYear){
            return 29
        }
        return 28
    }
    return 30
}

function isLeapYear(year){
    if(year<0){
        year = year*(-1)
    }
    if(year%400==0 || (year%100!=0 && year%4==0)){
        return true
    }
    return false
}

function isAStringOfUppercaseAndLowercaseLettersAndNumbers(string){
    string = string.split('')
    for(let i=0;i<string.length;i++){
        let chcode = string[i].charCodeAt(0)
        if(chcode>=48 && chcode<=57){
            continue
        }
        if(chcode>=65 && chcode<=90){
            continue
        }
        if(chcode>=97 && chcode<=122){
            continue
        }
        if(chcode==43 || chcode==45 || chcode==46 || chcode==64){
            continue
        }
        return false
    }
    return true
}

function isIncludeSpace(string){
    string = string.split('')
    for(let i=0;i<string.length;i++){
        if(string[i]==' '){
            return true
        }
    }
    return false
}

function getFullLengthNumber(n,length){
    n = JSON.stringify(n)
    let c = length - n.length
    for(let i=0;i<c;i++){
        n = '0' + n
    }
    return n
}

function getNumberString(n,x){
    n = JSON.stringify(n)
    for(let i = n.length;i<x;i++){
        n = '0' + n
    }
    return n
}