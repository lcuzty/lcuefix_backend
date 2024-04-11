const express = require('express')
const cors = require('cors')
const mysql = require('mysql2')
const crypto = require('crypto')
const cheerio = require('cheerio')
const multer = require('multer');
const formidable = require('formidable')
const path = require('path')
const fs = require('fs')
const tool = require('./tool')
const xlsx = require('xlsx')
const http = require('http')
const axios = require('axios')

const connectionConfig = {
    host: 'localhost',
    user: 'root',
    password: 'ldhq_online123',
    database: 'lcuefix',
    port: 3306
}

const config = {
    port: 1000,
    prefix: '/api',
    appId: 'wxc818fff9cc711a5e',
    appSecret: '1366db5d7744f0cc8c969b4910e24a5d',
    logOnConsole:false,
    logOnFile:true
}

// const options = {
//     key: fs.readFileSync('/cert/private.key'),
//     cert: fs.readFileSync('/cert/fullchain.pem')
// }

const connection = mysql.createConnection(connectionConfig);

console.clear()

function connectDatabase() {
    return new Promise((resolve, reject) => {
        connection.connect(err => {
            return resolve(err == null ? 'OK' : err.toString())
        })
    })
}

function execSQL(SQL) {
    return new Promise((resolve, reject) => {
        connection.query(SQL, (error, results, fields) => {
            if (error) {
                console.log(error)
                return reject()
            }
            return resolve(results)
        })
    })
}

async function main() {

    try {

        console.clear()

        let re = await connectDatabase()

        if (re != 'OK') {
            console.log('lcuefix server 未能正常启动，原因：' + re)
            process.exit(0)
        }

        const app = express();
        app.use(express.json())
        app.use(cors())

        const storage = multer.diskStorage({
            destination: 'files/',
            filename: function (req, file, cb) {
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                const fileExtension = path.extname(file.originalname);
                cb(null, file.fieldname + '-' + uniqueSuffix + fileExtension);
            }
        })

        const upload = multer({ storage: storage })

        app.get(config.prefix + '/export/file/:type', async (req, res) => {
            try {
                // data = decodeURIComponent(req.body.data)
                // data = checkRequestString(data)
                // if (data == null) {
                //     res.send('非法请求')
                //     return
                // }
                //
                // let re = generateVerificationCode()
                // addVCode('export',re)
                // tool.resSend(res, 1, '成功', re)
                await generateExcelFile(parseInt(req.params.type),res)


                clog('导出统计表格','admin',req.params.type,'成功',undefined)
            } catch (error) {
                console.log(error)
                tool.resSend(res, -2, '系统内部错误', undefined)
            }
        })

        app.post(config.prefix + '/sendFeedBack', async (req, res) => {
            try {
                data = decodeURIComponent(req.body.data)
                data = checkRequestString(data)
                if (data == null) {
                    res.send('非法请求')
                    return
                }
                //
                let re = await execSQL("select * from user where account = '2022400614'")
                if(re.lengthX!=0){
                    data.userInfo = JSON.parse(data.userInfo)
                    re = re[0]
                    let content = data.type + 
                    '\n' + data.content +
                    '\n账号：' + data.userInfo.account + 
                    '\n姓名：' + data.userInfo.name + 
                    '\n电话：' + data.userInfo.phoneNumber + 
                    '\nopenId：' + data.userInfo.openId
                    sendMessage(re.phoneNumber,content)
                }
                tool.resSend(res, 1, '成功', undefined)

                clog('发送反馈',data.userInfo.account,data.content,'成功',data)
            } catch (error) {
                console.log(error)
                tool.resSend(res, -2, '系统内部错误', undefined)
            }
        })

        app.post(config.prefix + '/user/changeName', async (req, res) => {
            try {
                data = decodeURIComponent(req.body.data)
                data = checkRequestString(data)
                if (data == null) {
                    res.send('非法请求')
                    return
                }
                //
                if((await execSQL("select * from user where account = '" + data.account + "'")).length==0){
                    tool.resSend(res, 0, '用户不存在', undefined)


                    clog('修改用户名',data.account,data.name,'用户不存在',data)
                    return
                }
                await execSQL("update user set name = '" + data.name + "' where account = '" + data.account + "'")
                tool.resSend(res, 1, '成功', undefined)


                clog('修改用户名',data.account,data.name,'成功',data)
            } catch (error) {
                console.log(error)
                tool.resSend(res, -2, '系统内部错误', undefined)
            }
        })

        app.post(config.prefix + '/com/reject', async (req, res) => {
            try {
                data = decodeURIComponent(req.body.data)
                data = checkRequestString(data)
                if (data == null) {
                    res.send('非法请求')
                    return
                }
                //
                let re = await execSQL("select * from complaint where id = '" + data.id + "'")
                if(re.length==0){
                    tool.resSend(res, 0, '此巡查不存在，可能已被删除', undefined)

                    
                    clog('审核驳回巡查',data.account,data.id + ' ' + data.content,'此巡查不存在，可能已被删除',data)
                    return
                }
                re = re[0]
                if((await checkPer(data.account,'sadmin',re.XQ,re.LX))==false && (await checkPer(data.account,'rep',re.XQ,re.LX))==false){
                    tool.resSend(res, 0, '提交失败，无处理权限', undefined)

                    clog('审核驳回巡查',data.account,data.id + ' ' + data.content,'提交失败，无处理权限',data)
                    return
                }
                try {
                    re.content3 = JSON.parse(re.content3)
                } catch (error) {
                    
                }
                try {
                    re.account3 = JSON.parse(re.account3)
                } catch (error) {
                    
                }

                let rexx = await execSQL("select * from rp where XQ = '" + re.XQ + "' and LX = '" + re.LX + "'")
                for(let i=0;i<rexx.length;i++){
                    let cc = '巡查处理结果驳回通知\n'
                    cc += '负责人您好，您或其他同校区类型的负责人于' + tool.formatTimeNew(new Date(re.rComTime)) + '处理的巡查被驳回，请重新处理被驳回的巡查。\n'
                    cc += '审核人：' + (await getUserName(data.account)) + '，驳回原因：' + data.content + '\n'
                    cc += '巡查内容：' + re.content + '\n'
                    cc += '校区类型：' + re.XQ + '-' + re.LX
                    sendMessage(rexx[i].phoneNumber, cc)
                }

                re.content3.push({
                    type:'reject',
                    account:data.account,
                    content:data.content,
                    reTime:(new Date()).toString()
                })
                re.account3.push(data.account)
                await execSQL("update complaint set content2 = '',account2 = '',rComTime = '',sat = 0,image2 = '',content3 = '" + JSON.stringify(re.content3) + "',account3 = '" + JSON.stringify(re.account3) + "' where id = '" + data.id + "'")
                tool.resSend(res, 1, '成功', undefined)

                clog('审核驳回巡查',data.account,data.id + ' ' + data.content,'成功',data)
            } catch (error) {
                console.log(error)
                tool.resSend(res, -2, '系统内部错误', undefined)
            }
        })

        async function getUserName(account){
            let re = await execSQL("select name from user where account = '" + account + "'")
            if(re.length==0){
                return '账号已注销'
            }
            return re[0].name
        }

        app.post(config.prefix + '/setAllUnSatComToSated', async (req, res) => {
            try {
                data = decodeURIComponent(req.body.data)
                data = checkRequestString(data)
                if (data == null) {
                    res.send('非法请求')
                    return
                }
                //
                await execSQL("update complaint set sat = 6 where sat = 0")
                tool.resSend(res, 1, '成功', undefined)


                clog('将所有巡查设为不需要评价','admin',undefined,'成功',data)
            } catch (error) {
                console.log(error)
                tool.resSend(res, -2, '系统内部错误', undefined)
            }
        })

        app.post(config.prefix + '/user/freeze', async (req, res) => {
            try {
                data = decodeURIComponent(req.body.data)
                data = checkRequestString(data)
                if (data == null) {
                    res.send('非法请求')
                    return
                }
                //
                if(data.op=='do'){
                    await execSQL("update user set type = '-' where account = '" + data.account + "'")

                    clog('冻结账号','admin',data.account,'成功',data)
                }else{
                    await execSQL("update user set type = 'U',newUser = '' where account = '" + data.account + "'")

                    clog('解冻账号','admin',data.account,'成功',data)
                }
                tool.resSend(res, 1, '成功', undefined)

                
            } catch (error) {
                console.log(error)
                tool.resSend(res, -2, '系统内部错误', undefined)
            }
        })

        app.post(config.prefix + '/user/delete', async (req, res) => {
            try {
                data = decodeURIComponent(req.body.data)
                data = checkRequestString(data)
                if (data == null) {
                    res.send('非法请求')
                    return
                }
                //
                await execSQL("delete from user where account = '" + data.account + "'")
                await execSQL("delete from rp where phoneNumber = '" + data.phoneNumber + "'")
                await execSQL("delete from rep where phoneNumber = '" + data.phoneNumber + "'")
                await execSQL("delete from sadmin where phoneNumber = '" + data.phoneNumber + "'")
                tool.resSend(res, 1, '成功', undefined)


                clog('删除账号','admin',data.account + ' ' + data.phoneNumber,'成功',data)
            } catch (error) {
                console.log(error)
                tool.resSend(res, -2, '系统内部错误', undefined)
            }
        })

        app.post(config.prefix + '/user/resetPassword', async (req, res) => {
            try {
                data = decodeURIComponent(req.body.data)
                data = checkRequestString(data)
                if (data == null) {
                    res.send('非法请求')
                    return
                }
                //
                await execSQL("update user set password = 'ef797c8118f02dfb649607dd5d3f8c7623048c9c063d532cc95c5ed7a898a64f' where account = '" + data.account + "'")
                tool.resSend(res, 1, '成功', undefined)


                clog('重置密码','admin',data.account,'成功',data)
            } catch (error) {
                console.log(error)
                tool.resSend(res, -2, '系统内部错误', undefined)
            }
        })

        app.post(config.prefix + '/user/unbindWeChat', async (req, res) => {
            try {
                data = decodeURIComponent(req.body.data)
                data = checkRequestString(data)
                if (data == null) {
                    res.send('非法请求')
                    return
                }
                //
                await execSQL("update user set openId = '' where account = '" + data.account + "'")
                tool.resSend(res, 1, '成功', undefined)


                clog('解绑微信','admin',data.account,'成功',data)
            } catch (error) {
                console.log(error)
                tool.resSend(res, -2, '系统内部错误', undefined)
            }
        })

        app.post(config.prefix + '/sadmin', async (req, res) => {
            try {
                data = decodeURIComponent(req.body.data)
                data = checkRequestString(data)
                if (data == null) {
                    res.send('非法请求')
                    return
                }
                //
                let re = await execSQL("select * from sadmin where phoneNumber = '" + data.phoneNumber + "'")
                if(data.op=='add'){
                    if(re.length==0){
                        execSQL("insert into sadmin value('" + data.phoneNumber + "')")
                    }
                    tool.resSend(res, 1, '成功', undefined)


                    clog('添加管理员','admin',data.phoneNumber,'成功',data)
                }else{
                    if(re.length!=0){
                        execSQL("delete from sadmin where phoneNumber = '" + data.phoneNumber + "'")
                    }
                    tool.resSend(res, 1, '成功', undefined)


                    clog('删除管理员','admin',data.phoneNumber,'成功',data)
                }

                
            } catch (error) {
                console.log(error)
                tool.resSend(res, -2, '系统内部错误', undefined)
            }
        })

        app.post(config.prefix + '/bg/singleUserInfo', async (req, res) => {
            try {
                data = decodeURIComponent(req.body.data)
                data = checkRequestString(data)
                if (data == null) {
                    res.send('非法请求')
                    return
                }
                //
                let re = await execSQL("select * from user where account = '" + data.account + "'")
                if (re.length == 0) {
                    tool.resSend(res, 0, '用户不存在', undefined)


                    clog('获取单个用户信息','admin',data.account + ' ' + data.password,'用户不存在',data)
                    return
                }
                re = re[0]
                re.per = {
                    rp: (await execSQL("select * from rp where phoneNumber = '" + re.phoneNumber + "'")),
                    rep: (await execSQL("select * from rep where phoneNumber = '" + re.phoneNumber + "'")),
                    sadmin: (await execSQL("select * from sadmin where phoneNumber = '" + re.phoneNumber + "'")).length == 1,
                    admin: re.type == 'admin'
                }

                tool.resSend(res, 1, '成功', re)


                clog('获取单个用户信息','admin',data.account + ' ' + data.password,'成功',data)
            } catch (error) {
                console.log(error)
                tool.resSend(res, -2, '系统内部错误', undefined)
            }
        })

        app.post(config.prefix + '/user/homeData', async (req, res) => {
            try {
                data = decodeURIComponent(req.body.data)
                data = checkRequestString(data)
                if (data == null) {
                    res.send('非法请求')
                    return
                }
                //
                let re = await execSQL("select * from user where account = '" + data.account + "'")
                if (re.length == 0) {
                    tool.resSend(res, 0, '用户不存在', undefined)


                    clog('用户主页数据',data.account,data.account,'用户不存在',data)
                    return
                }
                re = re[0]
                re.per = {
                    rp: (await execSQL("select * from rp where phoneNumber = '" + re.phoneNumber + "'")),
                    rep: (await execSQL("select * from rep where phoneNumber = '" + re.phoneNumber + "'")),
                    sadmin: (await execSQL("select * from sadmin where phoneNumber = '" + re.phoneNumber + "'")).length == 1,
                    admin: re.type == 'admin',
                    isSHFunctionOpen:(await getSetting('sh'))
                }

                re.per.showCLButton = re.per.rp.length!=0
                re.per.showSHButton = re.per.rep.length!=0
                re.per.showTJButton = re.per.admin
                re.per.showGLButton = (re.per.admin || re.per.sadmin)

                let re1 = []
                if(await getSystemSetting('myd')){
                    re1 = await execSQL("select * from complaint where account = '" + data.account + "' and sat = 0 and account2!=''")
                    re1.sort((a,b)=>{
                        return new Date(b.createTime) - new Date(a.createTime)
                    })
                    re1 = formatComTime(re1, await getSystemSetting('sh'), await getSystemSetting('myd'))
                    re1 = await getComplaintUserInfo(re1)
                }
                re.per.xcItems = re1

                re1 = await execSQL("select * from complaint where account = '" + data.account + "' and account2 = ''")
                re1.sort((a,b)=>{
                    return new Date(b.createTime) - new Date(a.createTime)
                })
                re1 = formatComTime(re1, await getSystemSetting('sh'), await getSystemSetting('myd'))
                re1 = await getComplaintUserInfo(re1)
                re.per.xcItems2 = re1

                if(re.per.showCLButton){
                    re1 = await execSQL("select * from complaint")
                    re1.sort((a,b)=>{
                        return new Date(b.createTime) - new Date(a.createTime)
                    })
                    re1 = formatComTime(re1, await getSystemSetting('sh'), await getSystemSetting('myd'))
                    re1 = await getComplaintUserInfo(re1)
                    let cre = []
                    let cre2 = []
                    for(let i=0;i<re1.length;i++){
                        if(isUserRPOrREP(re1[i],re.per.rp)){
                            if(re1[i].content2==''){
                                cre.push(re1[i])
                            }else{
                                cre2.push(re1[i])
                            }
                        }
                    }
                    re.per.clData = cre
                    re.per.clData2 = cre2
                }

                if(re.per.showSHButton){
                    re1 = await execSQL("select * from complaint")
                    re1.sort((a,b)=>{
                        return new Date(b.createTime) - new Date(a.createTime)
                    })
                    re1 = formatComTime(re1, await getSystemSetting('sh'), await getSystemSetting('myd'))
                    re1 = await getComplaintUserInfo(re1)
                    let cre = []
                    let cre1 = []
                    for(let i=0;i<re1.length;i++){
                        if(isUserRPOrREP(re1[i],re.per.rep) && re1[i].content2!=''){
                            cre.push(re1[i])
                            for(let i1=1;i1<re1[i].account3.length;i1+=2){
                                if(re1[i].account3[i1]==data.account){
                                    cre1.push(re1[i])
                                    break
                                }
                            }
                        }
                    }
                    re.per.shData = cre
                    re.per.shData2 = cre1
                }

                if(re.per.sadmin || re.per.admin){
                    re1 = await execSQL("select * from complaint")
                    re1.sort((a,b)=>{
                        return new Date(b.createTime) - new Date(a.createTime)
                    })
                    re1 = formatComTime(re1, await getSystemSetting('sh'), await getSystemSetting('myd'))
                    re1 = await getComplaintUserInfo(re1)
                    re.per.glData = re1
                }

                tool.resSend(res, 1, '成功', re)


                clog('用户主页数据',data.account,data.account,'成功',data)
            } catch (error) {
                console.log(error)
                tool.resSend(res, -2, '系统内部错误', undefined)
            }
        })

        async function checkPer(account,type,XQ,LX){
            account = await execSQL("select * from user where account = '" + account + "'")
            if(account.length==0){
                return false
            }
            if(account[0].type=='admin'){
                return true
            }
            account = account[0].phoneNumber
            let re = []
            if(type=='sadmin'){
                re = await execSQL("select * from sadmin where phoneNumber = '" + account + "'")
            }else{
                re = await execSQL("select * from " + type + " where phoneNumber = '" + account + "' and XQ = '" + XQ + "' and LX = '" + LX + "'")
            }
            return re.length!=0
        }

        function isUserRPOrREP(complaintItem,userRPOrREP = []){
            for(let i=0;i<userRPOrREP.length;i++){
                if(userRPOrREP[i].XQ==complaintItem.XQ && userRPOrREP[i].LX==complaintItem.LX){
                    return true
                }
            }
            return false
        }

        app.post(config.prefix + '/bg/settingList', async (req, res) => {
            try {
                data = decodeURIComponent(req.body.data)
                data = checkRequestString(data)
                if (data == null) {
                    res.send('非法请求')
                    return
                }
                //
                let re = {
                    tz_xts: JSON.parse((await execSQL("select value from setting where keyName = 'sendMessage'"))[0].value)[0],
                    tz_ycl: JSON.parse((await execSQL("select value from setting where keyName = 'sendMessage'"))[0].value)[1],
                    tz_myd: JSON.parse((await execSQL("select value from setting where keyName = 'myd'"))[0].value),
                    tz_sh: JSON.parse((await execSQL("select value from setting where keyName = 'sh'"))[0].value),
                    tz_xcsh: JSON.parse((await execSQL("select value from setting where keyName = 'xcsh'"))[0].value),
                    tz_zc: JSON.parse((await execSQL("select value from setting where keyName = 'zc'"))[0].value),
                    tz_zcyz: JSON.parse((await execSQL("select value from setting where keyName = 'zcyz'"))[0].value),
                }
                tool.resSend(res, 1, '成功', re)


                clog('功能开关列表','admin','','成功',data)
            } catch (error) {
                console.log(error)
                tool.resSend(res, -2, '系统内部错误', undefined)
            }
        })

        app.post(config.prefix + '/userList', async (req, res) => {
            try {
                data = decodeURIComponent(req.body.data)
                data = checkRequestString(data)
                if (data == null) {
                    res.send('非法请求')
                    return
                }
                //
                let re = await execSQL("select name,account,phoneNumber,type,newUser from user where account != 'admin'")
                tool.resSend(res, 1, '成功', re)


                clog('用户列表','admin','','成功',data)
            } catch (error) {
                console.log(error)
                tool.resSend(res, -2, '系统内部错误', undefined)
            }
        })

        app.post(config.prefix + '/user/reSetPassword', async (req, res) => {
            try {
                data = decodeURIComponent(req.body.data)
                data = checkRequestString(data)
                if (data == null) {
                    res.send('非法请求')
                    return
                }
                //
                if (data.account == 'admin') {
                    tool.resSend(res, 0, '此账号不支持重置密码', undefined)


                    clog('重置密码',data.account,data.account + ' ' + data.phoneNumber + ' ' + data.vcode,'此账号不支持重置密码',data)
                    return
                }
                let re = await execSQL("select * from user where account = '" + data.account + "'")
                if (re.length == 0) {
                    tool.resSend(res, 0, '此账号不存在', undefined)


                    clog('重置密码',data.account,data.account + ' ' + data.phoneNumber + ' ' + data.vcode,'此账号不存在',data)
                    return
                }
                re = re[0]
                if (re.phoneNumber != data.phoneNumber) {
                    tool.resSend(res, 0, '输入的电话号码与输入账号的电话号码不匹配', undefined)


                    clog('重置密码',data.account,data.account + ' ' + data.phoneNumber + ' ' + data.vcode,'输入的电话号码与输入账号的电话号码不匹配',data)
                    return
                }
                if (checkVCode(data.phoneNumber, data.vcode) == false) {
                    tool.resSend(res, 0, '验证码错误或已失效', undefined)


                    clog('重置密码',data.account,data.account + ' ' + data.phoneNumber + ' ' + data.vcode,'验证码错误或已失效',data)
                    return
                }
                await execSQL("update user set password = 'ef797c8118f02dfb649607dd5d3f8c7623048c9c063d532cc95c5ed7a898a64f' where account = '" + data.account + "'")
                tool.resSend(res, 1, '成功', undefined)


                clog('重置密码',data.account,data.account + ' ' + data.phoneNumber + ' ' + data.vcode,'成功',data)
            } catch (error) {
                console.log(error)
                tool.resSend(res, -2, '系统内部错误', undefined)
            }
        })

        app.post(config.prefix + '/user/reSetPasswordGetVCode', async (req, res) => {
            try {
                data = decodeURIComponent(req.body.data)
                data = checkRequestString(data)
                if (data == null) {
                    res.send('非法请求')
                    return
                }
                //
                if (data.account == 'admin') {
                    tool.resSend(res, 0, '此账号不支持重置密码', undefined)


                    clog('重置密码获取验证码',data.account,data.account + ' ' + data.phoneNumber,'此账号不支持重置密码',data)
                    return
                }
                let re = await execSQL("select * from user where account = '" + data.account + "'")
                if (re.length == 0) {
                    tool.resSend(res, 0, '此账号不存在', undefined)


                    clog('重置密码获取验证码',data.account,data.account + ' ' + data.phoneNumber,'此账号不存在',data)
                    return
                }
                re = re[0]
                if (re.phoneNumber != data.phoneNumber) {
                    tool.resSend(res, 0, '输入的电话号码与输入账号的电话号码不匹配', undefined)


                    clog('重置密码获取验证码',data.account,data.account + ' ' + data.phoneNumber,'输入的电话号码与输入账号的电话号码不匹配',data)
                    return
                }
                let re1 = generateVerificationCode()
                addVCode(data.phoneNumber, re1)
                sendMessage(data.phoneNumber, "您好，您正在请求重置登录密码。验证码为：" + re1 + "。请在重置密码界面输入此验证码以完成密码重置。该验证码有效期为10分钟，请勿泄露给他人。如非本人操作，请忽略此短信。")
                tool.resSend(res, 1, "成功", undefined)


                clog('重置密码获取验证码',data.account,data.account + ' ' + data.phoneNumber,'成功',data)
            } catch (error) {
                console.log(error)
                tool.resSend(res, -2, '系统内部错误', undefined)
            }
        })

        app.post(config.prefix + '/statistics', async (req, res) => {
            try {
                data = decodeURIComponent(req.body.data)
                data = checkRequestString(data)
                if (data == null) {
                    res.send('非法请求')
                    return
                }
                //
                
                let data1 = await generateData()


                tool.resSend(res, 1, '成功', data1)


                clog('后台统计数据','admin','','成功',data)
            } catch (error) {
                console.log(error)
                tool.resSend(res, -2, '系统内部错误', undefined)
            }
        })

        async function generateData(){
            let rej = {
                dimensionType:{

                }
            }
            let re = await execSQL("select * from complaint")
            let data = {}
            let data1 = tool.getJSONKeyValueArr(await execSQL("select * from dimension where type = '身份'"),'name')
            let data2 = tool.getJSONKeyValueArr(await execSQL("select * from dimension where type = '校区'"),'name')
            let data3 = tool.getJSONKeyValueArr(await execSQL("select * from dimension where type = '类别'"),'name')
            data1 = ['全部'].concat(data1)
            data2 = ['全部'].concat(data2)
            data3 = ['全部'].concat(data3)
            rej.dimensionType.sf = data1
            rej.dimensionType.xq = data2
            rej.dimensionType.lx = data3
            rej.dimensionType.dx = ['d7','d30','d90']
            for(let i1=0;i1<data1.length;i1++){
                let t1 = {}
                for(let i2=0;i2<data2.length;i2++){
                    let t2 = {}
                    for(let i3=0;i3<data3.length;i3++){
                        t2[data3[i3]] = {
                            coms:selectComs(re,data1[i1],data2[i2],data3[i3]),
                            typeName:data1[i1] + '-' + data2[i2] + '-' + data3[i3]
                        }
                        t2[data3[i3]]['status'] = getComsStatus(t2[data3[i3]].coms)
                        t2[data3[i3]]['timeLine'] = getTimeLine(t2[data3[i3]].coms)
                    }
                    t1[data2[i2]] = t2
                }
                data[data1[i1]] = t1
            }
            rej.dimension = data

            rej.user = {
                num:(await execSQL("select * from user")).length,
                ydj:(await execSQL("select * from user where type = '-'")).length,
                new:(await execSQL("select * from user where newUser = 'N'")).length,
                rpn:(await execSQL("select distinct phoneNumber from rp")).length,
                repn:(await execSQL("select distinct phoneNumber from rep")).length,
                sadminn:(await execSQL("select * from sadmin")).length,
            }

            return rej
        }

        function getTimeLine(coms){
            let rej = {
                d7:[],
                d30:[],
                d90:[],
                d7Titles:[],
                d30Titles:[],
                d90Titles:[]
            }
            coms.sort((a,b)=>{
                return new Date(b.createTime) - new Date(a.createTime)
            })
            let currentTime = new Date()
            let oneDayTime = 24*60*60*1000
            currentTime = new Date(currentTime.getTime() - currentTime.getHours()*60*60*1000 - currentTime.getMinutes()*60*1000 - currentTime.getSeconds()*1000)
            for(let i=0;i<90;i++){
                let t = getComsStatus(selectComsByTime(coms,currentTime,new Date(currentTime.getTime() + oneDayTime)))
                let tt = (currentTime.getMonth()+1).toString() + '/' + currentTime.getDate().toString()
                if(i<7){
                    rej.d7.push(t)
                    rej.d7Titles.push(tt)
                }
                if(i<30){
                    rej.d30.push(t)
                    rej.d30Titles.push(tt)
                }
                rej.d90.push(t)
                rej.d90Titles.push(tt)

                currentTime = new Date(currentTime.getTime() - oneDayTime)
            }
            return rej
        }

        function selectComsByTime(coms,startTime,endTime){
            let re = []
            for(let i=0;i<coms.length;i++){
                if(new Date(coms[i].createTime)>= startTime && new Date(coms[i].createTime)<endTime){
                    re.push(coms[i])
                }
            }
            return re
        }

        function selectComs(coms,SF,XQ,LX){
            re = []
            for(let i=0;i<coms.length;i++){
                if(coms[i].SF==SF && coms[i].XQ==XQ && coms[i].LX==LX){
                    re.push(coms[i])
                }
            }
            return re
        }

        function getComsStatus(coms){
            let rej = {
                all:coms.length,
                dcl:0,
                dpj:0,
                ycl:0,
                wcl:0,
                ywc:0
            }
            for(let i=0;i<coms.length;i++){
                if(coms[i].account2==''){
                    rej.dcl+=1
                }
                if(coms[i].account2!='' && coms[i].sat==0){
                    rej.dpj+=1
                }
                if(coms[i].account2!='' && coms[i].sat!=0){
                    rej.ywc+=1
                    if(coms[i].deal==1){
                        rej.ycl+=1
                    }else{
                        rej.wcl+=1
                    }
                }
            }
            return rej
        }

        function checkComItemStatus(com){
            if(com.account2==''){
                return 0
            }
            if(com.sat==0){
                return 1
            }
            return 2
        }

        app.post(config.prefix + '/user/changePassword', async (req, res) => {
            try {
                data = decodeURIComponent(req.body.data)
                data = checkRequestString(data)
                if (data == null) {
                    res.send('非法请求')
                    return
                }
                //
                let re = await execSQL("select * from user where phoneNumber = '" + data.phoneNumber + "'")
                if (re.length != 0) {
                    tool.resSend(res, 0, '此电话号码已与其他账号绑定', undefined)


                    clog('修改登录密码',data.account,data.account + ' ' + data.phoneNumber + ' ' + data.vcode,'此电话号码已与其他账号绑定',data)
                    return
                }
                if (checkVCode(data.phoneNumber, data.vcode) == false) {
                    tool.resSend(res, 0, '验证码错误或已失效', undefined)


                    clog('修改登录密码',data.account,data.account + ' ' + data.phoneNumber + ' ' + data.vcode,'验证码错误或已失效',data)
                    return
                }
                await execSQL("update user set phoneNumber = '" + data.phoneNumber + "' where account = '" + data.account + "'")
                await execSQL("update rp set phoneNumber = '" + data.phoneNumber + "' where phoneNumber = '" + data.oPhoneNumber + "'")
                await execSQL("update rep set phoneNumber = '" + data.phoneNumber + "' where phoneNumber = '" + data.oPhoneNumber + "'")
                await execSQL("update rep sadmin phoneNumber = '" + data.phoneNumber + "' where phoneNumber = '" + data.oPhoneNumber + "'")
                tool.resSend(res, 1, '成功', undefined)


                clog('修改登录密码',data.account,data.account + ' ' + data.phoneNumber + ' ' + data.vcode,'成功',data)
            } catch (error) {
                console.log(error)
                tool.resSend(res, -2, '系统内部错误', undefined)
            }
        })

        app.post(config.prefix + '/com/phoneNumberList', async (req, res) => {
            try {
                data = decodeURIComponent(req.body.data)
                data = checkRequestString(data)
                if (data == null) {
                    res.send('非法请求')
                    return
                }
                //
                let rej = {
                    xc:[],
                    cl:[],
                    sh:[]
                }
                let re = await execSQL("select * from complaint where id = '" + data.id + "'")
                if(re.length==0){
                    tool.resSend(res, 0, '此巡查不存在，可能已被删除', undefined)


                    clog('巡查联系人列表',undefined,data.id,'此巡查不存在，可能已被删除',data)
                    return
                }
                re = re[0]
                re.content3 = JSON.parse(re.content3)

                let re1 = await execSQL("select * from user where account = '" + re.account + "'")
                if(re1.length!=0){
                    re1 = re1[0]
                    rej.xc.push({
                        name:re1.name,
                        phoneNumber:re1.phoneNumber,
                        account:re1.account,
                        time:tool.formatTimeNew(new Date(re.rComTime))
                    })
                }

                re1 = []
                for(let i=0;i<re.content3.length;i+=2){
                    let flag = true
                    for(let i1=0;i1<re1.length;i1++){
                        if(re1[i1].account==re.content3[i].account){
                            flag = false
                            break
                        }
                    }
                    if(flag==false){
                        continue
                    }
                    let t = await execSQL("select * from user where account = '" + re.content3[i].account + "'")
                    if(t.length==0)continue
                    t = t[0]
                    re1.push({
                        name:t.name,
                        phoneNumber:t.phoneNumber,
                        account:t.account,
                        time:tool.formatTimeNew(new Date(re.content3[i].rComTime))
                    })
                }
                rej.cl = JSON.parse(JSON.stringify(re1))

                re1 = []
                for(let i=1;i<re.content3.length;i+=2){
                    let flag = true
                    for(let i1=0;i1<re1.length;i1++){
                        if(re1[i1].account==re.content3[i].account){
                            flag = false
                            break
                        }
                    }
                    if(flag==false){
                        continue
                    }
                    let t = await execSQL("select * from user where account = '" + re.content3[i].account + "'")
                    if(t.length==0)continue
                    t = t[0]
                    re1.push({
                        name:t.name,
                        phoneNumber:t.phoneNumber,
                        account:t.account,
                        time:tool.formatTimeNew(new Date(re.content3[i].reTime))
                    })
                }
                rej.sh = JSON.parse(JSON.stringify(re1))

                tool.resSend(res, 1, '成功', rej)


                clog('巡查联系人列表',re.account,data.id,'成功',data)
            } catch (error) {
                console.log(error)
                tool.resSend(res, -2, '系统内部错误', undefined)
            }
        })

        app.post(config.prefix + '/com/sat', async (req, res) => {
            try {
                data = decodeURIComponent(req.body.data)
                data = checkRequestString(data)
                if (data == null) {
                    res.send('非法请求')
                    return
                }
                //
                let re = await execSQL("select * from complaint where id = '" + data.id + "'")
                if (re.length == 0) {
                    tool.resSend(res, 0, '此巡查已被删除', undefined)


                    clog('评价巡查',undefined,data.id + data.sat.toString(),'此巡查已被删除',data)
                    return
                }
                re = re[0]
                if (re.sat != 0) {
                    tool.resSend(res, 0, '此巡查已被评价', undefined)


                    clog('评价巡查',re.account,data.id + data.sat.toString(),'此巡查已被评价',data)
                    return
                }
                await execSQL("update complaint set sat = " + data.sat + ", satTime = '" + (new Date()).toString() + "' where id = '" + data.id + "'")
                tool.resSend(res, 1, '成功', undefined)


                clog('评价巡查',re.account,data.id + data.sat.toString(),'成功',data)
            } catch (error) {
                console.log(error)
                tool.resSend(res, -2, '系统内部错误', undefined)
            }
        })

        app.post(config.prefix + '/com/withdraw', async (req, res) => {
            try {
                data = decodeURIComponent(req.body.data)
                data = checkRequestString(data)
                if (data == null) {
                    res.send('非法请求')
                    return
                }
                //
                let re = await execSQL("select * from complaint where id = '" + data.id + "'")
                if (re.length == 0) {
                    tool.resSend(res, 0, '此巡查已被删除', undefined)


                    clog('撤回巡查',undefined,data.id,'此巡查已被删除',data)
                    return
                }
                re = re[0]
                if (re.account2 != '') {
                    tool.resSend(res, 0, '此巡查已被处理，不能撤回', undefined)


                    clog('撤回巡查',re.account,data.id,'此巡查已被处理，不能撤回',data)
                    return
                }
                re = JSON.parse(re.image)
                for (let i = 0; i < re.length; i++) {
                    await deleteFile(re[i])
                }
                await execSQL("delete from complaint where id = '" + data.id + "'")
                tool.resSend(res, 1, '成功', undefined)


                clog('撤回巡查',re.account,data.id,'成功',data)
            } catch (error) {
                console.log(error)
                tool.resSend(res, -2, '系统内部错误', undefined)
            }
        })

        async function deleteFile(name) {
            await fs.unlink('./files/' + name, err => {
                if (err) console.log(err)
            })
        }

        app.post(config.prefix + '/com/deal', async (req, res) => {
            try {
                data = decodeURIComponent(req.body.data)
                data = checkRequestString(data)
                if (data == null) {
                    res.send('非法请求')
                    return
                }
                //
                let re = await execSQL("select * from complaint where id = '" + data.id + "'")
                if (re.length == 0) {
                    tool.resSend(res, -1, '此巡查已被删除', undefined)


                    clog('处理巡查',data.account2,data.id,'此巡查已被删除',data)
                    return
                }
                re = re[0]
                if((await checkPer(data.account2,'rp',re.XQ,re.LX))==false){
                    tool.resSend(res, 0, '提交失败，无处理权限', undefined)


                    clog('处理巡查',data.account2,data.id,'提交失败，无处理权限',data)
                    return
                }
                if (re.content2 != '') {
                    tool.resSend(res, 0, '提交失败，因为此巡查已被处理', undefined)


                    clog('处理巡查',data.account2,data.id,'提交失败，因为此巡查已被处理',data)
                    return
                }
                let content3 = JSON.parse(re.content3)
                let account3 = JSON.parse(re.account3)
                content3.push({
                    type:'deal',
                    account:data.account2,
                    isDeal:data.isDeal,
                    content:data.content2,
                    image:data.image2,
                    rComTime:(new Date()).toString()
                })
                account3.push(data.account2)
                await execSQL("update complaint set content2 = '" + data.content2 + "', image2 = '" + JSON.stringify(data.image2) + "', account2 = '" + data.account2 + "', rComTime = '" + (new Date()).toString() + "',content3 = '" + JSON.stringify(content3) + "',account3 = '" + JSON.stringify(account3) + "',deal = " + data.isDeal.toString() + ",sat = " + ((await getSetting('myd'))?'0':'6') + " where id = '" + data.id + "'")
                let re1 = await execSQL("select phoneNumber from user where account = '" + re.account + "'")
                let ret = JSON.parse((await execSQL("select value from setting where keyName = 'sendMessage'"))[0].value)
                let cc = ''
                if (re1.length != 0 && ret[1]) {
                    re1 = re1[0]
                    if(data.isDeal==1){
                        if(await getSetting('myd')){
                            cc = '巡查处理通知\n'
                            cc += '巡查人您好，您于' + tool.formatTimeNew(new Date(re.createTime)) + '提交的巡查已被处理。请尽快登录小程序完成本次巡查的满意度调查。\n'
                            cc += '负责人：' + (await getUserName(data.account2)) + '，留言：' + data.content2 + '\n'
                            cc += '巡查内容：' + re.content + '\n'
                            cc += '校区类型：' + re.XQ + '-' + re.LX

                            sendMessage(re1.phoneNumber, cc)
                        }else{
                            cc = '巡查处理通知\n'
                            cc += '巡查人您好，您于' + tool.formatTimeNew(new Date(re.createTime)) + '提交的巡查已被处理。本次巡查不需要进行满意度调查。\n'
                            cc += '负责人：' + (await getUserName(data.account2)) + '，留言：' + data.content2 + '\n'
                            cc += '巡查内容：' + re.content + '\n'
                            cc += '校区类型：' + re.XQ + '-' + re.LX

                            sendMessage(re1.phoneNumber, cc)
                        }
                    }else{
                        if(await getSetting('myd')){
                            cc = '巡查处理通知\n'
                            cc += '巡查人您好，负责人拒绝处理您于' + tool.formatTimeNew(new Date(re.createTime)) + '提交的巡查。请尽快登录小程序完成本次巡查的满意度调查。\n'
                            cc += '负责人：' + (await getUserName(data.account2)) + '，留言：' + data.content2 + '\n'
                            cc += '巡查内容：' + re.content + '\n'
                            cc += '校区类型：' + re.XQ + '-' + re.LX

                            sendMessage(re1.phoneNumber, cc)
                        }else{
                            cc = '巡查处理通知\n'
                            cc += '巡查人您好，负责人拒绝处理您于' + tool.formatTimeNew(new Date(re.createTime)) + '提交的巡查。本此巡查不需要进行满意度调查。\n'
                            cc += '负责人：' + (await getUserName(data.account2)) + '，留言：' + data.content2 + '\n'
                            cc += '巡查内容：' + re.content + '\n'
                            cc += '校区类型：' + re.XQ + '-' + re.LX

                            sendMessage(re1.phoneNumber, cc)
                        }
                    }
                    
                }
                if(await getSetting('xcsh')){
                    let re00 = await execSQL("select * from rep where XQ = '" + re.XQ + "' and LX = '" + re.LX + "'")
                    for(let i=0;i<re00.length;i++){
                        cc = '巡查待审核通知\n'
                        cc += '审核人您好，您有一条新的巡查待审核，请尽快打开小程序主页的审核页面完成审核。感谢您对巡查速办的支持与理解。\n'
                        cc += '负责人：' + (await getUserName(data.account2)) + '，留言：' + data.content2 + '\n'
                        cc += '巡查内容：' + re.content + '\n'
                        cc += '校区类型：' + re.XQ + '-' + re.LX

                        sendMessage(re00[i].phoneNumber, cc)
                    }
                }
                tool.resSend(res, 1, '成功', undefined)


                clog('处理巡查',data.account2,data.id,'成功',data)
            } catch (error) {
                console.log(error)
                tool.resSend(res, -2, '系统内部错误', undefined)
            }
        })

        app.post(config.prefix + '/com/getSingle', async (req, res) => {
            try {
                data = decodeURIComponent(req.body.data)
                data = checkRequestString(data)
                if (data == null) {
                    res.send('非法请求')
                    return
                }
                //
                let re = await execSQL("select * from complaint where id = '" + data.id + "'")
                re = formatComTime(re, await getSystemSetting('sh'), await getSystemSetting('myd'))
                re = await getComplaintUserInfo(re)
                if (re.length == 0) {
                    tool.resSend(res, 0, '失败', undefined)


                    clog('获取单个巡查信息',undefined,data.id,'巡查不存在',data)
                    return
                }
                re = re[0]
                re.userInfo = (await execSQL("select * from user where account = '" + re.account + "'"))[0]
                if(re.userInfo){
                    re.userInfo.avatarText = re.userInfo.name.slice(re.userInfo.name.length - 2, re.userInfo.name.length)
                }
                if (re.account2 != '') {
                    re.userInfo2 = (await execSQL("select * from user where account = '" + re.account2 + "'"))[0]
                    if(re.userInfo2){
                        re.userInfo2.avatarText = re.userInfo2.name.slice(re.userInfo2.name.length - 2, re.userInfo2.name.length)
                    }
                    
                }
                tool.resSend(res, 1, '成功', re)


                clog('获取单个巡查信息',undefined,data.id,'成功',data)
            } catch (error) {
                console.log(error)
                tool.resSend(res, -2, '系统内部错误', undefined)
            }
        })

        app.post(config.prefix + '/com/get', async (req, res) => {
            try {
                data = decodeURIComponent(req.body.data)
                data = checkRequestString(data)
                if (data == null) {
                    res.send('非法请求')
                    return
                }
                //
                if (data.type == 'admin') {
                    let re = await execSQL("select * from complaint")
                    re = formatComTime(re, await getSystemSetting('sh'), await getSystemSetting('myd'))
                    re = await getComplaintUserInfo(re)
                    re = GLComs(re, data, await getSystemSetting('sh'), await getSystemSetting('myd'))
                    re.sort((a, b) => {
                        return new Date(b.createTime) - new Date(a.createTime)
                    })
                    tool.resSend(res, 1, '成功', re)


                    clog('获取巡查列表','admin','管理员【详见data】','成功',data)
                    return
                }
                if (data.type == 'U') {
                    let re = await execSQL("select * from complaint where account = '" + data.account + "'")
                    re = formatComTime(re, await getSystemSetting('sh'), await getSystemSetting('myd'))
                    re = await getComplaintUserInfo(re)
                    re.sort((a, b) => {
                        return new Date(b.createTime) - new Date(a.createTime)
                    })
                    let re0 = {
                        all: re,
                        dpj: [],
                        dcl: []
                    }
                    for (let i = 0; i < re.length; i++) {
                        if (re[i].content2 == '') {
                            re0.dcl.push(re[i])
                            continue
                        }
                        if (re[i].sat == 0) {
                            re0.dpj.push(re[i])
                        }
                    }
                    tool.resSend(res, 1, '成功', re0)


                    clog('获取巡查列表',data.account,'巡查人【详见data】','成功',data)
                    return
                }
                let re = await execSQL("select * from user where account = '" + data.account + "'")
                re = re[0].phoneNumber
                re = await execSQL("select * from rp where phoneNumber = '" + re + "'")
                let re1 = []
                for (let i = 0; i < re.length; i++) {
                    let t = await execSQL("select * from complaint where XQ = '" + re[i].XQ + "' and LX = '" + re[i].LX + "'")
                    for (let i1 = 0; i1 < t.length; i1++) {
                        re1.push(t[i1])
                    }
                }
                re1 = formatComTime(re1, await getSystemSetting('sh'), await getSystemSetting('myd'))
                re1 = await getComplaintUserInfo(re1)
                re1.sort((a, b) => {
                    return new Date(b.createTime) - new Date(a.createTime)
                })
                let re00 = {
                    all: re1,
                    dcl: [],
                    dpj: []
                }
                for (let i = 0; i < re1.length; i++) {
                    if (re1[i].content2 == '') {
                        re00.dcl.push(re1[i])
                        continue
                    }
                    if (re1[i].sat == 0) {
                        re00.dpj.push(re1[i])
                    }
                }
                tool.resSend(res, 1, '成功', re00)


                clog('获取巡查列表',data.account,'巡查人【详见data】','成功',data)
            } catch (error) {
                console.log(error)
                tool.resSend(res, -2, '系统内部错误', undefined)
            }
        })

        function GLComs(arr, data, isSHOpen, isMYDDCOpen) {
            let re = []
            for (let i = 0; i < arr.length; i++) {
                switch (data.tsSearchFormStatus) {
                    case '待处理':
                        if (arr[i].account2 != '') continue
                        break;
                    case '待审核':
                        if (arr[i].account2 != '') continue
                        break;
                    case '待评价':
                        if (!(arr[i].account2 != '' && arr[i].sat == 0)) continue
                        break;
                    case '已完成':
                        if (arr[i].account2 == '' || arr[i].sat == 0) continue
                        break;
                }
                if (arr[i].userInfo2 == undefined) {
                    if(arr[i].userInfo!=undefined){
                        if (arr[i].userInfo.name.indexOf(data.tsSearchFormInput) == -1 && arr[i].account.indexOf(data.tsSearchFormInput) == -1 && arr[i].userInfo.phoneNumber.indexOf(data.tsSearchFormInput) == -1) continue
                    }
                } else {
                    if (arr[i].userInfo.name.indexOf(data.tsSearchFormInput) == -1 && arr[i].account.indexOf(data.tsSearchFormInput) == -1 && arr[i].userInfo.phoneNumber.indexOf(data.tsSearchFormInput) == -1 && arr[i].userInfo2.name.indexOf(data.tsSearchFormInput) == -1 && arr[i].account2.indexOf(data.tsSearchFormInput) == -1 && arr[i].userInfo2.phoneNumber.indexOf(data.tsSearchFormInput) == -1) continue
                }
                if (data.tsSearchFormXQ != '不限制' && arr[i].XQ != data.tsSearchFormXQ) continue
                if (data.tsSearchFormLX != '不限制' && arr[i].XQ != data.tsSearchFormLX) continue
                if (data.tsSearchFormTSStart == '限制') {
                    if (new Date(data.tsSearchFormTSStartDate) > new Date(arr[i].createTime)) continue
                }
                if (data.tsSearchFormTSEnd == '限制') {
                    if (new Date(data.tsSearchFormTSEndDate) < new Date(arr[i].createTime)) continue
                }
                re.push(arr[i])
            }
            return re
        }

        async function sendMessage(phoneNumber, content) {
            console.log("已发送短信给", phoneNumber, '，内容是', content)
            let prefix = '巡查速办  '
            let xml1 = '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:sms="http://sms.webservice.com">   <soapenv:Header/>   <soapenv:Body>      <sms:saveSmsInfo>         <sms:in0>'
            let xml2 = '</sms:in0>      </sms:saveSmsInfo>   </soapenv:Body></soapenv:Envelope>'
            let args = {
              tp_name: 'cwxt',
              sys_id: 'mp',
              module_id: 'sms',
              secret_key: 'gCr1JkOuZfvnpJLxzBjDtNo/woQ=',
              interface_method: 'sms',
              person_info: '||||' + phoneNumber,
              sms_info: prefix + ' ' + content,
              send_priority: '3',
              operator_id: '管理员',
              operator_id_number: '09901',
              operator_unit_id: '1001016',
              operator_unit_name: '网络信息中心',
              templet_id: '0',
              receipt_id: '0',
              send_sys_id: '1',
              send_sys_name: '财务管理系统',
              user_browser: 'FireFox'
            }
            axios({  
                method: 'post',  
                url: 'http://vp.lcu.edu.cn/tp_mp/service/SmsService', // 替换为实际的接口地址  
                data: xml1 + JSON.stringify(args) + xml2,  
                headers: {  
                    'Content-Type': 'text/xml;charset=UTF-8',
                    'SOAPAction':'',
                }  
            })  
            .then(response => {  
                
                clog('> 发短信',undefined,content,'成功',phoneNumber)
            })  
            .catch(error => {  

                clog('> 发短信',undefined,content,'失败',phoneNumber)
            });
        }

        function formatComTime(arr, isSHOpen, isMYDDCOpen) {
            for (let i = 0; i < arr.length; i++) {
                try {
                    arr[i].image = JSON.parse(arr[i].image)
                } catch (error) {

                }
                try {
                    arr[i].image2 = JSON.parse(arr[i].image2)
                } catch (error) {

                }
                try{
                    arr[i].content3 = JSON.parse(arr[i].content3)
                }catch(e){

                }
                try{
                    arr[i].account3 = JSON.parse(arr[i].account3)
                }catch(e){

                }
                try{
                    arr[i].lalo = JSON.parse(arr[i].lalo)
                }catch(e){

                }
                arr[i].createTimeRead = tool.formatTimeNew(new Date(arr[i].createTime))
                arr[i].comTimeRead = tool.formatTimeNew(new Date(arr[i].comTime))
                if (arr[i].rComTime != '') {
                    arr[i].rComTimeRead = tool.formatTimeNew(new Date(arr[i].rComTime))
                }
                if (arr[i].satTime != '') {
                    arr[i].satTimeRead = tool.formatTimeNew(new Date(arr[i].satTime))
                }
                if (new Date(arr[i].comTime) < new Date() && arr[i].content2 == '') {
                    arr[i].showCB = true
                } else {
                    arr[i].showCB = false
                }
                if (arr[i].account2 == '') {
                    arr[i].statusText = '待处理'
                } else {
                    if (arr[i].sat == 0) {
                        arr[i].statusText = '待评价'
                    } else {
                        arr[i].statusText = '已完成'
                    }
                }
            }
            return arr
        }

        async function getSystemSetting(keyName) {
            if (keyName == undefined) return false
            let re = await execSQL("select value from setting where keyName = '" + keyName + "'")
            if (re.length == 0) return false
            re = re[0]
            re = re.value
            try {
                re = JSON.parse(re)
            } catch (error) {

            }
            return re
        }

        async function getComplaintUserInfo(arr) {
            for (let i = 0; i < arr.length; i++) {

                for(let i1=0;i1<arr[i].content3.length;i1++){
                    let re1 = await execSQL("select * from user where account = '" + arr[i].content3[i1].account + "'")
                    if(re1.length==0)continue
                    re1[0].avatarText = re1[0].name.slice(re1[0].name.length - 2, re1[0].name.length)
                    arr[i].content3[i1].userInfo = re1[0]
                    if(arr[i].content3[i1].reTime){
                        arr[i].content3[i1].reTime = tool.formatTimeNew(new Date(arr[i].content3[i1].reTime))
                    }
                    if(arr[i].content3[i1].rComTime){
                        arr[i].content3[i1].rComTime = tool.formatTimeNew(new Date(arr[i].content3[i1].rComTime))
                    }
                    
                }

                let re = await execSQL("select * from user where account = '" + arr[i].account + "'")
                if (re.length != 0) {
                    re[0].avatarText = re[0].name.slice(re[0].name.length - 2, re[0].name.length)
                    arr[i].userInfo = re[0]
                }
                if (arr[i].account2 != '') {
                    re = await execSQL("select * from user where account = '" + arr[i].account2 + "'")
                    if(re.length==0)continue
                    re[0].avatarText = re[0].name.slice(re[0].name.length - 2, re[0].name.length)
                    if (re.length != 0) {
                        arr[i].userInfo2 = re[0]
                    }
                }
            }
            return arr
        }

        app.post(config.prefix + '/user/phoneNumber', async (req, res) => {
            try {
                data = decodeURIComponent(req.body.data)
                data = checkRequestString(data)
                if (data == null) {
                    res.send('非法请求')
                    return
                }
                //
                let re = await execSQL("select phoneNumber from user where account = '" + data.account + "'")
                tool.resSend(res, 1, '成功', re[0].phoneNumber)


                clog('获取用户电话号码',undefined,data.account,'成功',data)
            } catch (error) {
                console.log(error)
                tool.resSend(res, -2, '系统内部错误', undefined)
            }
        })

        app.post(config.prefix + '/com/hasten', async (req, res) => {
            try {
                data = decodeURIComponent(req.body.data)
                data = checkRequestString(data)
                if (data == null) {
                    res.send('非法请求')
                    return
                }
                //
                let re1 = await execSQL("select * from complaint where id = '" + data.id + "'")
                re1 = re1[0]

                if (re1.hTime != '' && tool.formatTimeNew(new Date(re1.hTime)).indexOf('今天') != -1) {
                    tool.resSend(res, 0, '此巡查今日你已催办', undefined)


                    clog('催办',undefined,data.id,'此巡查今日你已催办',data)
                    return
                }

                await execSQL("update complaint set hTime = '" + (new Date()).toString() + "' where id = '" + data.id + "'")

                let re = await execSQL("select phoneNumber from rp where XQ = '" + re1.XQ + "' and LX = '" + re1.LX + "'")
                for (let i = 0; i < re.length; i++) {
                    cc = '巡查催办通知\n'
                    cc += '负责人您好，有巡查超时未处理，该巡查新建于' + tool.formatTimeNew(new Date(re1.createTime)) + '，请尽快处理。\n'
                    cc += '巡查人：' + (await getUserName(re1.account)) + '，文字描述：' + re1.content + '\n'
                    cc += '校区类型：' + re1.XQ + '-' + re1.LX
                    
                    await sendMessage(re[i].phoneNumber, cc)
                }


                tool.resSend(res, 1, '成功', undefined)


                clog('催办',undefined,data.id,'成功',data)
            } catch (error) {
                console.log(error)
                tool.resSend(res, -2, '系统内部错误', undefined)
            }
        })

        app.post(config.prefix + '/com/delete', async (req, res) => {
            try {
                data = decodeURIComponent(req.body.data)
                data = checkRequestString(data)
                if (data == null) {
                    res.send('非法请求')
                    return
                }
                //
                if(data.account!='admin'){
                    tool.resSend(res, 0, '权限不够', undefined)


                    clog('删除巡查',data.account,data.id,'权限不够',data)
                    return
                }
                let re = await execSQL("select * from complaint where id = '" + data.id + "'")
                if(re.length!=0){

                    re = re[0]
                    re.image = JSON.parse(re.image)
                    for(let i=0;i<re.image.length;i++){
                        await deleteFile(re.image[i])
                    }
                    re.content3 = JSON.parse(re.content3)
                    for(let i=0;i<re.content3.length;i++){
                        let t = re.content3[i].image
                        if(t==undefined)continue
                        try {
                            t = JSON.parse(t)
                        } catch (error) {
                            
                        }
                        
                        for(let i1=0;i1<t.length;i1++){
                            await deleteFile(t[i1])
                        }
                    }
                    await execSQL("delete from complaint where id = '" + data.id + "'")

                }
                tool.resSend(res, 1, '成功', undefined)


                clog('删除巡查',data.account,data.id,'成功',data)
                //发送短信
            } catch (error) {
                console.log(error)
                tool.resSend(res, -2, '系统内部错误', undefined)
            }
        })

        app.post(config.prefix + '/com/add', async (req, res) => {
            try {
                data = decodeURIComponent(req.body.data)
                data = checkRequestString(data)
                if (data == null) {
                    res.send('非法请求')
                    return
                }
                //
                await execSQL("insert into complaint values('" + data.account + tool.getCurrentTimeReadableString() + "','" + data.account + "','','[]','" + data.SF + "','" + data.XQ + "','" + data.LX + "','" + data.content + "','" + JSON.stringify(data.img) + "','','','[]',0,'" + tool.getCurrentTimeConvertableString() + "','" + data.comTime + "','','','','" + JSON.stringify(data.lalo) + "',0)")

                let re = await execSQL("select phoneNumber from rp where XQ = '" + data.XQ + "' and LX = '" + data.LX + "'")
                let ret = JSON.parse((await execSQL("select value from setting where keyName = 'sendMessage'"))[0].value)
                if (ret[0]) {
                    for (let i = 0; i < re.length; i++) {
                        cc = '新建巡查通知\n'
                        cc += '负责人您好，您有新的巡查待处理，请尽快登录巡查速办小程序查看并处理。感谢您的关注与及时处理！\n'
                        cc += '负责人：' + (await getUserName(data.account)) + '，文字描述：' + data.content + '\n'
                        cc += '校区类型：' + data.XQ + '-' + data.LX

                        await sendMessage(re[i].phoneNumber, cc)
                    }
                }

                await tool.waitSeconds(1)
                tool.resSend(res, 1, '成功', undefined)


                clog('新建巡查',data.account,data.content,'成功',data)
                //发送短信
            } catch (error) {
                console.log(error)
                tool.resSend(res, -2, '系统内部错误', undefined)
            }
        })

        app.post(config.prefix + '/rp/delete', async (req, res) => {
            try {
                data = decodeURIComponent(req.body.data)
                data = checkRequestString(data)
                if (data == null) {
                    res.send('非法请求')
                    return
                }
                //
                await execSQL("delete from " + data.type + " where LX = '" + data.LX + "' and XQ = '" + data.XQ + "' and phoneNumber = '" + data.phoneNumber + "'")
                tool.resSend(res, 1, '成功', undefined)


                clog('删除负责人权限','admin',data.phoneNumber + ' ' + data.XQ + ' ' + data.LX,'成功',data)
            } catch (error) {
                console.log(error)
                tool.resSend(res, -2, '系统内部错误', undefined)
            }
        })

        app.post(config.prefix + '/rp/add', async (req, res) => {
            try {
                data = decodeURIComponent(req.body.data)
                data = checkRequestString(data)
                if (data == null) {
                    res.send('非法请求')
                    return
                }
                //
                let re = await execSQL("select * from user where phoneNumber='" + data.phoneNumber + "'")
                if (re.length == 0) {
                    tool.resSend(res, 0, '此电话号码没有注册', undefined)


                    clog('添加负责人权限','admin',data.phoneNumber + ' ' + data.XQ + ' ' + data.LX,'此电话号码没有注册',data)
                    return
                }
                re = await execSQL("select * from " + data.type + " where XQ = '" + data.XQ + "' and LX = '" + data.LX + "' and phoneNumber = '" + data.phoneNumber + "'")
                if (re.length != 0) {
                    tool.resSend(res, 0, '此电话号码已添加', undefined)


                    clog('添加负责人权限','admin',data.phoneNumber + ' ' + data.XQ + ' ' + data.LX,'此电话号码已添加',data)
                    return
                }
                await execSQL("insert into " + data.type + " values('" + data.phoneNumber + "','" + data.XQ + "','" + data.LX + "')")
                tool.resSend(res, 1, '成功', undefined)


                clog('添加负责人权限','admin',data.phoneNumber + ' ' + data.XQ + ' ' + data.LX,'成功',data)
            } catch (error) {
                console.log(error)
                tool.resSend(res, -2, '系统内部错误', undefined)
            }
        })

        app.post(config.prefix + '/rp/get', async (req, res) => {
            try {
                data = decodeURIComponent(req.body.data)
                data = checkRequestString(data)
                if (data == null) {
                    res.send('非法请求')
                    return
                }
                //
                let re = await execSQL("select * from rp where XQ = '" + data.XQ + "' and LX = '" + data.LX + "'")
                for (let i = 0; i < re.length; i++) {
                    re[i].type = 'rp'
                }
                let re1 = await execSQL("select * from rep where XQ = '" + data.XQ + "' and LX = '" + data.LX + "'")
                for (let i = 0; i < re1.length; i++) {
                    re1[i].type = 'rep'
                    re.push(re1[i])
                }
                let reu = await execSQL("select * from user")
                for (let i = 0; i < re.length; i++) {
                    for (let i1 = 0; i1 < reu.length; i1++) {
                        if (re[i].phoneNumber == reu[i1].phoneNumber) {
                            re[i].userInfo = reu[i1]
                            break
                        }
                    }
                }
                tool.resSend(res, 1, '成功', re)


                clog('获取负责人列表','admin',data.XQ + ' ' + data.LX,'成功',data)
            } catch (error) {
                console.log(error)
                tool.resSend(res, -2, '系统内部错误', undefined)
            }
        })

        app.post(config.prefix + '/dimension/add', async (req, res) => {
            try {
                data = decodeURIComponent(req.body.data)
                data = checkRequestString(data)
                if (data == null) {
                    res.send('非法请求')
                    return
                }
                //
                let re = await execSQL("select * from dimension where type = '" + data.type + "' and name = '" + data.name + "'")
                if (re.length != 0) {
                    tool.resSend(res, 0, '此' + data.type + '已存在', undefined)


                    clog('添加多维度信息','admin',data.type + ' ' + data.name,'此' + data.type + '已存在',data)
                    return
                }
                await execSQL("insert into dimension values('" + data.type + "','" + data.name + "')")
                tool.resSend(res, 1, '成功', undefined)


                clog('添加多维度信息','admin',data.type + ' ' + data.name,'成功',data)
            } catch (error) {
                console.log(error)
                tool.resSend(res, -2, '系统内部错误', undefined)
            }
        })

        app.post(config.prefix + '/dimension/delete', async (req, res) => {
            try {
                data = decodeURIComponent(req.body.data)
                data = checkRequestString(data)
                if (data == null) {
                    res.send('非法请求')
                    return
                }
                //
                await execSQL("delete from dimension where type = '" + data.type + "' and name = '" + data.name + "'")
                if (data.type == '类别') {
                    await execSQL("delete from rp where LX = '" + data.name + "'")
                    await execSQL("delete from rep where LX = '" + data.name + "'")
                    await execSQL("delete from complaint where LX = '" + data.name + "'")
                }
                if (data.type == '校区') {
                    await execSQL("delete from rp where XQ = '" + data.name + "'")
                    await execSQL("delete from rep where XQ = '" + data.name + "'")
                    await execSQL("delete from complaint where XQ = '" + data.name + "'")
                }
                tool.resSend(res, 1, '成功', undefined)


                clog('删除多维度信息','admin',data.type + ' ' + data.name,'成功',data)
            } catch (error) {
                console.log(error)
                tool.resSend(res, -2, '系统内部错误', undefined)
            }
        })

        app.post(config.prefix + '/dimension/get', async (req, res) => {
            try {
                data = decodeURIComponent(req.body.data)
                data = checkRequestString(data)
                if (data == null) {
                    res.send('非法请求')
                    return
                }
                //
                let re = await execSQL("select * from dimension")
                re.sort((a, b) => {
                    if (a.type > b.type) {
                        return 1
                    }
                    if (a.type < b.type) {
                        return -1
                    }
                    return 0
                })
                let data1 = [[]]
                for (let i = 0; i < re.length; i++) {
                    if (data1[data1.length - 1].length == 0) {
                        data1[data1.length - 1].push(re[i])
                    } else {
                        if (data1[data1.length - 1][data1[data1.length - 1].length - 1].type != re[i].type) {
                            data1.push([re[i]])
                        } else {
                            data1[data1.length - 1].push(re[i])
                        }

                    }
                }
                let rej = {
                    "身份": [],
                    "校区": [],
                    "类别": []
                }
                if (data1[0].length != 0) {
                    for (let i = 0; i < data1.length; i++) {
                        rej[data1[i][0].type] = data1[i]
                    }
                }
                tool.resSend(res, 1, '成功', rej)


                clog('获取多维度信息列表',undefined,'','成功',data)
            } catch (error) {
                console.log(error)
                tool.resSend(res, -2, '系统内部错误', undefined)
            }
        })

        app.post(config.prefix + '/register/add', async (req, res) => {
            try {
                data = decodeURIComponent(req.body.data)
                data = checkRequestString(data)
                if (data == null) {
                    res.send('非法请求')
                    return
                }
                //
                let re1 = await execSQL("select * from user where phoneNumber = '" + data.phoneNumber + "'")
                if (re1.length != 0) {
                    tool.resSend(res, 0, '此电话号码已被注册', undefined)


                    clog('注册',undefined,data.phoneNumber + ' ' + data.account + ' ' + data.name,'此电话号码已被注册',data)
                    return
                }
                if (checkVCode(data.phoneNumber, data.vcode) == false) {
                    tool.resSend(res, 0, '验证码已失效或错误', undefined)


                    clog('注册',undefined,data.phoneNumber + ' ' + data.account + ' ' + data.name,'验证码已失效或错误',data)
                    return
                }
                let re = await execSQL("select account from user where account = '" + data.account + "'")
                if (re.length != 0) {
                    tool.resSend(res, 0, '此学号/工号已被注册', undefined)


                    clog('注册',undefined,data.phoneNumber + ' ' + data.account + ' ' + data.name,'此学号/工号已被注册',data)
                    return
                }
                await execSQL("insert into user values('" + data.account + "','" + data.password + "','" + data.name + "','" + data.phoneNumber + "','','" + ((await getSetting("zcyz"))?'-':'U') + "','" + ((await getSetting("zcyz"))?'N':'') + "')")
                tool.resSend(res, 1, '注册成功' + ((await getSetting("zcyz"))?'，新账号处于冻结状态，管理员审核通过后即可正常登录使用':''), undefined)


                clog('注册',undefined,data.phoneNumber + ' ' + data.account + ' ' + data.name,'成功',data)
            } catch (error) {
                tool.resSend(res, -2, '系统内部错误', undefined)
            }
        })

        app.post(config.prefix + '/register/getVcode', async (req, res) => {
            try {
                data = decodeURIComponent(req.body.data)
                data = checkRequestString(data)
                if (data == null) {
                    res.send('非法请求')
                    return
                }
                //
                let re1 = await execSQL("select * from user where phoneNumber = '" + data.phoneNumber + "'")
                if (re1.length != 0) {
                    tool.resSend(res, 0, '此电话号码已被注册', undefined)


                    clog('注册获取验证码',undefined,data.phoneNumber,'此电话号码已被注册',data)
                    return
                }
                let re = generateVerificationCode()
                addVCode(data.phoneNumber, re)
                
                sendMessage(data.phoneNumber, "您的验证码为：" + re + "。请在巡查速办微信小程序中输入此验证码完成操作。切勿泄露给他人，感谢您的使用！")
                tool.resSend(res, 1, "成功", undefined)


                clog('注册获取验证码',undefined,data.phoneNumber + ' ' + re,'成功',data)
            } catch (error) {
                tool.resSend(res, -2, '系统内部错误', undefined)
            }
        })

        app.post(config.prefix + '/setting/addOrUpdate', async (req, res) => {
            try {
                data = decodeURIComponent(req.body.data)
                data = checkRequestString(data)
                if (data == null) {
                    res.send('非法请求')
                    return
                }
                //
                let re = await execSQL("select * from setting where keyName = '" + data.keyName + "'")
                if (typeof (data.value) != 'string') {
                    data.value = JSON.stringify(data.value)
                }
                if (re.length == 0) {
                    await execSQL("insert into setting values('" + data.keyName + "','" + data.value + "')")
                    tool.resSend(res, 1, '成功', undefined)
                    return
                }
                await execSQL("update setting set value = '" + data.value + "' where keyName = '" + data.keyName + "'")
                tool.resSend(res, 1, '成功', undefined)


                clog('更新设置或添加设置',undefined,data.keyName + ' ' + data.value.toString(),'成功',data)
            } catch (error) {
                tool.resSend(res, -2, '系统内部错误', undefined)
            }
        })

        app.post(config.prefix + '/setting/get', async (req, res) => {
            try {
                data = decodeURIComponent(req.body.data)
                data = checkRequestString(data)
                if (data == null) {
                    res.send('非法请求')
                    return
                }
                //
                let re = await execSQL("select * from setting where keyName = '" + data.keyName + "'")
                if (re.length == 0) {
                    tool.resSend(res, 0, '无此设置', undefined)


                    clog('获取设置',undefined,data.keyName,'无此设置',data)
                    return
                }
                re = re[0]
                try {
                    re.value = JSON.parse(re.value)
                } catch (error) {

                }
                tool.resSend(res, 1, '成功', re.value)


                clog('获取设置',undefined,data.keyName,'成功',data)
            } catch (error) {
                tool.resSend(res, -2, '系统内部错误', undefined)
            }
        })

        app.post(config.prefix + '/changePassword', async (req, res) => {
            try {
                data = decodeURIComponent(req.body.data)
                data = checkRequestString(data)
                if (data == null) {
                    res.send('非法请求')
                    return
                }
                //
                let re = await execSQL("select * from user where account = '" + data.account + "'")
                if (re.length == 0) {
                    tool.resSend(res, 0, '修改失败', undefined)


                    clog('修改登录密码',data.account,data.np,'修改失败',data)
                    return
                }
                re = re[0]
                if (re.password != data.op) {
                    tool.resSend(res, 0, '原密码错误', undefined)


                    clog('修改登录密码',data.account,data.np,'原密码错误',data)
                    return
                }
                await execSQL("update user set password = '" + data.np + "' where account = '" + data.account + "'")
                await execSQL("update user set openId = '' where account = '" + data.account + "'")
                tool.resSend(res, 1, '成功', undefined)


                clog('修改登录密码',data.account,data.np,'成功',data)
                return
            } catch (error) {
                tool.resSend(res, -2, '系统内部错误', undefined)
            }
        })

        app.post(config.prefix + '/exitLogin', async (req, res) => {
            try {
                data = decodeURIComponent(req.body.data)
                data = checkRequestString(data)
                if (data == null) {
                    res.send('非法请求')
                    return
                }
                //
                await execSQL("update user set openId = '' where account = '" + data.account + "'")
                tool.resSend(res, 1, '成功', re)


                clog('退出登录',data.account,'','成功',data)
                return
            } catch (error) {
                tool.resSend(res, -2, '系统内部错误', undefined)
            }
        })

        app.post(config.prefix + '/login', async (req, res) => {
            try {
                data = decodeURIComponent(req.body.data)
                data = checkRequestString(data)
                if (data == null) {
                    res.send('非法请求')
                    return
                }
                //
                let re = await execSQL("select * from user where account = '" + data.account + "'")
                if (re.length == 0) {
                    tool.resSend(res, 0, '用户不存在', undefined)


                    clog('登录',data.account,data.account,'用户不存在',data)
                    return
                }
                re = re[0]
                if(re.type=='-' && re.newUser=='N'){
                    tool.resSend(res, 0, '此账号尚未通过管理员审核', undefined)


                    clog('登录',data.account,data.account,'此账号尚未通过管理员审核',data)
                    return
                }
                if(re.type=='-'){
                    tool.resSend(res, 0, '此账号已被冻结', undefined)


                    clog('登录',data.account,data.account,'此账号已被冻结',data)
                    return
                }
                if (re.openId != data.openId && re.openId != '') {
                    tool.resSend(res, 0, '此账号已与其他微信用户绑定', undefined)


                    clog('登录',data.account,data.account,'此账号已与其他微信用户绑定',data)
                    return
                }
                if (re.password != data.password) {
                    tool.resSend(res, 0, '密码错误', undefined)


                    clog('登录',data.account,data.account,'密码错误',data)
                    return
                }
                await execSQL("update user set openId = '" + data.openId + "' where account = '" + data.account + "'")
                delete re.password
                let re1 = await execSQL("select XQ,LX from rp where phoneNumber = '" + re.phoneNumber + "'")
                if (re1.length != 0) {
                    re.otherTypeData = re1
                    re.otherTypeName = 'rp'
                }
                let re2 = await execSQL("select XQ,LX from rep where phoneNumber = '" + re.phoneNumber + "'")
                if (re2.length != 0) {
                    re.otherTypeData = re2
                    re.otherTypeName = 'rep'
                }
                tool.resSend(res, 1, '成功', re)


                clog('登录',data.account,data.account,'成功',data)
                return
            } catch (error) {
                tool.resSend(res, -2, '系统内部错误', undefined)
            }
        })

        app.post(config.prefix + '/autoLogin', async (req, res) => {
            try {
                data = decodeURIComponent(req.body.data)
                data = checkRequestString(data)
                if (data == null) {
                    res.send('非法请求')
                    return
                }
                //
                let re = await execSQL("select * from user where openId = '" + data.openId + "'")
                if (re.length == 0) {
                    tool.resSend(res, 0, '未绑定账号', undefined)


                    clog('自动登录',undefined,data.openId,'未绑定账号',data)
                } else {
                    delete re[0].password
                    re = re[0]
                    if(re.type=='-'){
                        tool.resSend(res, 0, '此账号已被冻结', re)


                        clog('自动登录',re.account,data.openId,'此账号已被冻结',data)
                        return
                    }
                    let re1 = await execSQL("select XQ,LX from rp where phoneNumber = '" + re.phoneNumber + "'")
                    if (re1.length != 0) {
                        re.otherTypeData = re1
                        re.otherTypeName = 'rp'
                    }
                    let re2 = await execSQL("select XQ,LX from rep where phoneNumber = '" + re.phoneNumber + "'")
                    if (re2.length != 0) {
                        re.otherTypeData = re2
                        re.otherTypeName = 'rep'
                    }
                    tool.resSend(res, 1, '自动登录成功', re)


                    clog('自动登录',re.account,data.openId,'成功',data)
                }
            } catch (error) {
                tool.resSend(res, -2, '系统内部错误', undefined)
            }
        })

        app.post(config.prefix + '/openId', async (req, res) => {
            try {
                data = decodeURIComponent(req.body.data)
                data = checkRequestString(data)
                if (data == null) {
                    res.send('非法请求')
                    return
                }
                //
                var config1 = {
                    method: 'post',
                    url: "https://api.weixin.qq.com/sns/jscode2session?appid=" + config.appId + "&secret=" + config.appSecret + "&js_code=" + data.code + "&grant_type=authorization_code",
                    data: data
                }
                axios(config1)
                    .then((res1) => {
                        tool.resSend(res, 1, '成功', res1.data.openid)


                        clog('获取openId',undefined,data.code,'成功',data)
                    }).catch(err => {
                        tool.resSend(res, 0, '无法获取', undefined)


                        clog('获取openId',undefined,data.code,'失败',data)
                    })

                    
            } catch (error) {
                tool.resSend(res, -2, '系统内部错误', undefined)
            }
        })

        app.post(config.prefix + '/file/upload', upload.single('file'), async (req, res) => {
            if (!req.file) {
                res.status(400).json({ error: '上传失败' });


                clog('上传文件',undefined,'','失败',data)
            } else {
                res.json({
                    status: 1,
                    content: '上传成功',
                    results: req.file.filename
                })


                clog('上传文件',undefined,req.file.filename,'成功',data)
            }
        })

        app.get(config.prefix + '/log', async (req,res)=>{
            try {
                const XLSX = require('xlsx')
                const wb = XLSX.utils.book_new();

                let re = await execSQL("select * from log")
                for(let i=0;i<re.length;i++){
                    re[i] = Object.values(re[i])
                }
                re.reverse()

                let ws = XLSX.utils.aoa_to_sheet(re);
                XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
                const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.send(excelBuffer);
            } catch (error) {
                
            }
        })

        app.get(config.prefix + '/file/download/:filename', (req, res) => {
            const filename = req.params.filename;
            const filePath = path.join('files', filename);
            if (!fs.existsSync(filePath)) {
                return res.status(404).json({
                    status: 0,
                    content: '无此文件'
                });
            }
            res.setHeader('Content-Disposition', `filename=${filename}`);
            const fileStream = fs.createReadStream(filePath);
            fileStream.pipe(res);
        })

        app.get('/.well-known/acme-challenge/Yt7LjyBvoDxhEf1dsG3Za0E5QuZE8D0DTvMt4vrwtEg', (req, res) => {
            res.send('Yt7LjyBvoDxhEf1dsG3Za0E5QuZE8D0DTvMt4vrwtEg.k7HHcUxcqFkTRiOUrxCRlunUrUAq4-HlK5QMdJZPBck')
        })

        // app.get(config.prefix + '/exit', async (req, res) => {
        //     process.exit(0)
        // })

        // app.use((err, req, res, next) => {
        //     tool.resSend(res,-2,'系统内部错误',undefined)
        //     // console.log(err)
        // })

        let vcodes = []

        function addVCode(phoneNumber, vcode) {
            for (let i = 0; i < vcodes.length; i++) {
                if (vcodes[i].phoneNumber == phoneNumber) {
                    vcodes[i].vcode = vcode
                    vcodes[i].time = new Date()
                    return
                }
            }
            vcodes.push({
                phoneNumber: phoneNumber,
                vcode: vcode,
                time: new Date()
            })
        }

        function checkVCode(phoneNumber, vcode) {
            for (let i = vcodes.length - 1; i >= 0; i--) {
                if (new Date() - vcodes[i].time > 600000) {
                    delete vcodes[i]
                }
            }
            for (let i = 0; i < vcodes.length; i++) {
                if (vcodes[i].phoneNumber == phoneNumber) {
                    if (vcodes[i].vcode == vcode) {
                        return true
                    } else {
                        return false
                    }
                }
            }
            return false
        }

        app.listen(config.port, async () => {
            console.log('\x1b[32mlcuefix Server Started.\x1b[37m')
            console.log('port:' + config.port.toString())
            // console.log('系统出现异常请加QQ 2367075171')

            setInterval(async ()=>{
                if(await getSetting('myd')){
                    let re = await execSQL("select * from complaint where sat = 0 and rComTime!=''")
                    for(let i=0;i<re.length;i++){
                        if(((new Date()).getTime() - (new Date(re[i].rComTime)).getTime())>=24*60*60*1000){
                            await execSQL("update complaint set sat = 5 where id = '" + re[i].id + "'")
                        }
                    }
                }
            },60000*5)

        })

    } catch (error) {
        console.log(111, error)
    }

}

main()

async function getSetting(keyName){
    let re = await execSQL("select value from setting where keyName = '" + keyName + "'")
    if(re.length==0){
        return undefined
    }
    re = re[0].value
    try {
        re = JSON.parse(re)
    } catch (error) {
        
    }
    return re
}

function generateVerificationCode() {
    let re = ''
    for (let i = 0; i < 6; i++) {
        re += parseInt(Math.random() * 10 % 10).toString()
    }
    return re
}

function checkRequestString(data) {
    data = tool.decodeString(data)
    if (isJSONString(data) == false) {
        return null
    }
    return JSON.parse(data)
}

function isJSONString(str) {
    try {
        JSON.parse(str);
        return true;
    } catch (e) {
        return false;
    }
}

function checkPathExists(fileOrFolderPath) {
    return new Promise((resolve) => {
        fs.access(fileOrFolderPath, fs.constants.F_OK, (err) => {
            if (err) {
                return resolve(false);
            } else {
                return resolve(true);
            }
        });
    });
}

function createFileWithContent(filePath, content) {
    return new Promise((resolve, reject) => {
        fs.writeFile(filePath, content, { flag: 'wx' }, (err) => {
            if (err) {
                reject(err);
            } else {
                return resolve();
            }
        });
    });
}

function getCurrentTimeReadableString() {
    let currentTime = new Date
    let re = ''
    re += getFullLengthNumber(currentTime.getFullYear(), 4) + '/'
    re += getFullLengthNumber(currentTime.getMonth() + 1, 2) + '/'
    re += getFullLengthNumber(currentTime.getDate(), 2) + ' '
    re += getFullLengthNumber(currentTime.getHours(), 2) + ':'
    re += getFullLengthNumber(currentTime.getMinutes(), 2) + ':'
    re += getFullLengthNumber(currentTime.getSeconds(), 2) + ''
    return re
}

function getCurrentYearMonthDayString() {
    let currentTime = new Date
    let re = ''
    re += getFullLengthNumber(currentTime.getFullYear(), 4)
    re += getFullLengthNumber(currentTime.getMonth() + 1, 2)
    re += getFullLengthNumber(currentTime.getDate(), 2)
    return re
}

async function clog(apiName, userAccount, content, isSuccess, data) {
    try {
        content = content.toString()
    } catch (error) {
        
    }
    if(content==undefined || content==null)content = ''
    let user = ''
    if(userAccount=='admin'){
        user = 'admin'
    }else{
        if(userAccount==undefined){
            user = '未知用户'
        }else{
            let re = await execSQL("select name,phoneNumber from user where account = '" + userAccount + "'")
            if(re.length==0){
                user = '账号不存在'
            }else{
                re = re[0]
                user = re.name + '（' + re.phoneNumber + '）'
            }
        }
    }
    if(config.logOnConsole){
        console.log(getCurrentTimeReadableString() + " " + apiName + "\t\t\t\t" + user + "\t\t" + content + "\t\t" + isSuccess)
    }
    try {
        if(config.logOnFile){
            await execSQL("insert into log values('" + getCurrentTimeReadableString() + "','" + apiName + "','" + user + "','" + content + "','" + isSuccess + "','" + JSON.stringify(data) + "')")
            // outputStringToFile('records/' + getCurrentYearMonthDayString() + '.txt', "" + getCurrentTimeReadableString() + "\t" + apiName + "\t\t" + user + "\t\t" + content + "\t\t" + isSuccess + "\t\t\t\t" + JSON.stringify(data) + "\n")
        }
    } catch (error) {
        
    }
}

async function outputStringToFile(fileName, content) {
    if (await fs.existsSync(fileName) == false) {
        await fs.writeFile(fileName, getCurrentYearMonthDayString() + '\n', () => { });
    }
    await fs.appendFile(fileName, content, () => { });
}

function getFullLengthNumber(n,length){
    n = JSON.stringify(n)
    let c = length - n.length
    for(let i=0;i<c;i++){
        n = '0' + n
    }
    return n
}

async function generateExcelFile(type,res){
    if(type==1){
        const XLSX = require('xlsx')
        const wb = XLSX.utils.book_new();

        let XQs = tool.getJSONKeyValueArr(await execSQL("select * from dimension where type = '校区'"),'name')
        for(let v=0;v<XQs.length;v++){
            let currentXQ = XQs[v]
            let table = [[currentXQ]]
            let SFs = tool.getJSONKeyValueArr(await execSQL("select * from dimension where type = '身份'"),'name')
            let subTitleLine = ['状态']
            let subTitleLine2 = ['类别\\身份']
            let status = ['待处理','待评价','已处理','未处理','合计']
            for(let i=0;i<status.length;i++){
                subTitleLine.push(status[i])
                for(let i1=1;i1<SFs.length;i1++){
                    subTitleLine.push('')
                }
                for(let i1=0;i1<SFs.length;i1++){
                    subTitleLine2.push(SFs[i1])
                }
            }
            table.push(subTitleLine)
            table.push(subTitleLine2)

            let LXs = tool.getJSONKeyValueArr(await execSQL("select * from dimension where type = '类别'"),'name')
            for(let i=0;i<LXs.length;i++){
                let currentLX = LXs[i]
                let currentLine = [currentLX]
                for(let i1=0;i1<status.length;i1++){
                    for(let i2=0;i2<SFs.length;i2++){
                        let currentSF = SFs[i2]
                        switch (status[i1]) {
                            case '待处理':
                                currentLine.push((await execSQL("select * from complaint where account2 = '' and XQ = '" + currentXQ + "' and SF = '" + currentSF + "' and LX = '" + currentLX + "'")).length)
                                break;
                            case '待评价':
                                currentLine.push((await execSQL("select * from complaint where account2 != '' and sat = 0 and XQ = '" + currentXQ + "' and SF = '" + currentSF + "' and LX = '" + currentLX + "'")).length)
                                break;
                            case '已处理':
                                currentLine.push((await execSQL("select * from complaint where account2 != '' and sat != 0 and deal = 1 and XQ = '" + currentXQ + "' and SF = '" + currentSF + "' and LX = '" + currentLX + "'")).length)
                                break;
                            case '未处理':
                                currentLine.push((await execSQL("select * from complaint where account2 != '' and sat != 0 and deal = 0 and XQ = '" + currentXQ + "' and SF = '" + currentSF + "' and LX = '" + currentLX + "'")).length)
                                break;
                            case '合计':
                                currentLine.push((await execSQL("select * from complaint where XQ = '" + currentXQ + "' and SF = '" + currentSF + "' and LX = '" + currentLX + "'")).length)
                                break;
                        }
                        
                    }
                }
                table.push(JSON.parse(JSON.stringify(currentLine)))
            }

            let hj1 = ['合计']
            let hj2 = ['']

            for(let i=0;i<status.length;i++){
                for(let i1=0;i1<SFs.length;i1++){
                    let currentSF = SFs[i1]
                    switch (status[i]) {
                        case '待处理':
                            hj1.push((await execSQL("select * from complaint where account2 = '' and XQ = '" + currentXQ + "' and SF = '" + currentSF + "'")).length)
                            break;
                        case '待评价':
                            hj1.push((await execSQL("select * from complaint where account2 != '' and sat = 0 and XQ = '" + currentXQ + "' and SF = '" + currentSF + "'")).length)
                            break;
                        case '已处理':
                            hj1.push((await execSQL("select * from complaint where account2 != '' and sat !=0 and deal = 1 and XQ = '" + currentXQ + "' and SF = '" + currentSF + "'")).length)
                            break;
                        case '未处理':
                            hj1.push((await execSQL("select * from complaint where account2 != '' and sat !=0 and deal = 0 and XQ = '" + currentXQ + "' and SF = '" + currentSF + "'")).length)
                            break;
                        case '合计':
                            hj1.push((await execSQL("select * from complaint where XQ = '" + currentXQ + "' and SF = '" + currentSF + "'")).length)
                            break;
                    }
                }
                switch (status[i]) {
                    case '待处理':
                        hj2.push((await execSQL("select * from complaint where account2 = '' and XQ = '" + currentXQ + "'")).length)
                        break;
                    case '待评价':
                        hj2.push((await execSQL("select * from complaint where account2 != '' and sat = 0 and XQ = '" + currentXQ + "'")).length)
                        break;
                    case '已处理':
                        hj2.push((await execSQL("select * from complaint where account2 != '' and sat !=0 and deal = 1 and XQ = '" + currentXQ + "'")).length)
                        break;
                    case '未处理':
                        hj2.push((await execSQL("select * from complaint where account2 != '' and sat !=0 and deal = 0 and XQ = '" + currentXQ + "'")).length)
                        break;
                    case '合计':
                        hj2.push((await execSQL("select * from complaint where XQ = '" + currentXQ + "'")).length)
                        break;
                }
                hj2.push('')
            }

            table.push(hj1)
            table.push(hj2)

            let ws = XLSX.utils.aoa_to_sheet(table);
            ws['!merges'] = []
            for(let i=0;i<status.length;i++){
                ws['!merges'].push({ 
                    s: { 
                        r: 1, 
                        c: 1 + (SFs.length * i) 
                    }, 
                    e: {
                        r: 1, 
                        c: 1 + (SFs.length * i + SFs.length - 1) 
                    } 
                })
                ws['!merges'].push({ 
                    s: { 
                        r: 4 + LXs.length, 
                        c: 1 + (SFs.length * i) 
                    }, 
                    e: {
                        r: 4 + LXs.length, 
                        c: 1 + (SFs.length * i + SFs.length - 1) 
                    } 
                })
            }
            ws['!merges'].push({ 
                s: { 
                    r: 0, 
                    c: 0
                }, 
                e: {
                    r: 0, 
                    c: SFs.length * status.length
                } 
            })
            ws['!merges'].push({ 
                s: { 
                    r: 3 + LXs.length, 
                    c: 0
                }, 
                e: {
                    r: 4 + LXs.length, 
                    c: 0
                } 
            })
            
            // const merge = { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } };
            // XLSX.utils.sheet_merge(ws, merge.r, merge.c, merge.e.r, merge.e.c);
            XLSX.utils.book_append_sheet(wb, ws, currentXQ);
        }
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
            
        const fileName = '巡查速办导出数据.xlsx';

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        // res.setHeader('Content-Disposition', 'attachment; filename=' + fileName);
            
        res.send(excelBuffer);
    }
    if(type==2){
        const XLSX = require('xlsx')
        const wb = XLSX.utils.book_new();

        let table = [
            ['巡查内容'],
            ['序号','巡查人姓名','巡查人学号/工号','巡查人电话号码','身份','校区','类别','文字描述','巡查时间','最晚处理时间','满意度调查','满意度调查时间','经度','纬度','状态']
        ]

        function getSatName(n){
            switch (n) {
                case 1:
                    return '非常不满意'
                case 2:
                    return '不太满意'
                case 3:
                    return '满意'
                case 4:
                    return '比较满意'
                case 5:
                    return '非常满意'
            }
        }

        let re = await execSQL("select * from complaint")
        re.sort((a,b)=>{
            return new Date(b.createTime) - new Date(a.createTime)
        })
        maxContentNum = 0
        for(let i=0;i<re.length;i++){
            re[i].content3 = JSON.parse(re[i].content3)
            let currentCom = re[i]
            let currentLine = [i+1]
            let currentComUserInfo = await execSQL("select * from user where account = '" + currentCom.account + "'")
            if(currentComUserInfo.length==0){
                currentLine.push('账号已注销')
                currentLine.push('')
                currentLine.push('')
            }else{
                currentComUserInfo = currentComUserInfo[0]
                currentLine.push(currentComUserInfo.name)
                currentLine.push(currentComUserInfo.account)
                currentLine.push(currentComUserInfo.phoneNumber)
            }
            currentLine.push(currentCom.SF)
            currentLine.push(currentCom.XQ)
            currentLine.push(currentCom.LX)
            currentLine.push(currentCom.content)
            currentLine.push(tool.formatTimeNew(new Date(currentCom.createTime)))
            currentLine.push(tool.formatTimeNew(new Date(currentCom.comTime)))
            currentLine.push(currentCom.sat==0?'':(currentCom.sat==6?'不需要评价':getSatName(currentCom.sat)))
            currentLine.push(currentCom.sat==0?'':tool.formatTimeNew(new Date(currentCom.satTime)))
            if(currentCom.lalo==null || currentCom.lalo==undefined || currentCom=='[null,null]'){
                currentLine.push('')
                currentLine.push('')
            }else{
                currentLine.push(JSON.parse(currentCom.lalo)[0])
                currentLine.push(JSON.parse(currentCom.lalo)[1])
            }
            if(currentCom.account2==''){
                currentLine.push('待处理')
            }
            if(currentCom.account2!='' && currentCom.sat==0){
                currentLine.push('待评价')
            }
            if(currentCom.account2!='' && currentCom.sat!=0 && currentCom.deal==0){
                currentLine.push('未处理')
            }
            if(currentCom.account2!='' && currentCom.sat!=0 && currentCom.deal==1){
                currentLine.push('已处理')
            }

            let currentComContent3 = currentCom.content3
            if(currentComContent3.length>maxContentNum){
                maxContentNum = currentComContent3.length
            }
            for(let i1=0;i1<currentComContent3.length;i1++){
                let currentCC3Item = currentComContent3[i1]
                let currentCC3UserInfo = await execSQL("select * from user where account = '" + currentCC3Item.account + "'")
                if(currentCC3UserInfo.length==0){
                    currentLine.push('')
                    currentLine.push('')
                    currentLine.push('')
                }else{
                    currentCC3UserInfo = currentCC3UserInfo[0]
                    currentLine.push(currentCC3UserInfo.name)
                    currentLine.push(currentCC3UserInfo.account)
                    currentLine.push(currentCC3UserInfo.phoneNumber)
                }
                if(i1%2==0){
                    currentLine.push(currentCC3Item.isDeal==0?'未处理':'已处理')
                    currentLine.push(currentCC3Item.content)
                    currentLine.push(tool.formatTimeNew(new Date(currentCC3Item.rComTime)))
                }else{
                    currentLine.push(currentCC3Item.content)
                    currentLine.push(tool.formatTimeNew(new Date(currentCC3Item.reTime)))
                }
            }
            table.push(currentLine)
        }
        for(let i=0;i<maxContentNum;i++){
            if(i%2==0){
                let prefix = '第' + (i/2+1).toString() + '次处理'
                table[1].push(prefix + '-负责人姓名')
                table[1].push(prefix + '-负责人学号/工号')
                table[1].push(prefix + '-负责人电话号码')
                table[1].push(prefix + '-是否处理')
                table[1].push(prefix + '-负责人留言')
                table[1].push(prefix + '-处理时间')
            }else{
                let prefix = '第' + ((i-1)/2+1).toString() + '次审核驳回'
                table[1].push(prefix + '-审核人姓名')
                table[1].push(prefix + '-审核人学号/工号')
                table[1].push(prefix + '-审核人电话号码')
                table[1].push(prefix + '-审核人留言')
                table[1].push(prefix + '-审核时间')
            }
        }


        let ws = XLSX.utils.aoa_to_sheet(table);

        ws['!merges']=[{ 
            s: { 
                r: 0, 
                c: 0
            }, 
            e: {
                r: 0, 
                c: table[1].length-1
            } 
        }]

        XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
            
        const fileName = '巡查速办导出内容.xlsx';

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        // res.setHeader('Content-Disposition', 'attachment; filename=' + fileName);
            
        res.send(excelBuffer);
    }
    if(type==3){
        const XLSX = require('xlsx')
        const wb = XLSX.utils.book_new();

        let table = [
            ['用户信息表'],
            ['序号','学号/工号','姓名','电话号码','绑定微信','类型（-表示已冻结）','尚未通过审核的新用户']
        ]

        let re = await execSQL("select * from user")
        for(let i=0;i<re.length;i++){
            let currentLine = [i+1]
            let currentUser = re[i]
            currentLine.push(currentUser.account)
            currentLine.push(currentUser.name)
            currentLine.push(currentUser.phoneNumber)
            currentLine.push(currentUser.openId==''?'否':'是')
            currentLine.push(currentUser.type=='admin'?'超级管理员':(currentUser.type=='U'?'普通用户':'已冻结的普通用户'))
            currentLine.push(currentUser.newUser==''?'否':'是')
            table.push(currentLine)
        }

        let ws = XLSX.utils.aoa_to_sheet(table);

        ws['!merges']=[{ 
            s: { 
                r: 0, 
                c: 0
            }, 
            e: {
                r: 0, 
                c: table[1].length-1
            } 
        }]

        XLSX.utils.book_append_sheet(wb, ws, '用户信息表');

        table = [
            ['管理员表'],
            ['序号','学号/工号','姓名','电话号码']
        ]

        re = await execSQL("select * from user,sadmin where user.phoneNumber=sadmin.phoneNumber")

        for(let i=0;i<re.length;i++){
            let currentLine = [i+1]
            let currentUser = re[i]
            currentLine.push(currentUser.account)
            currentLine.push(currentUser.name)
            currentLine.push(currentUser.phoneNumber)
            table.push(currentLine)
        }

        ws = XLSX.utils.aoa_to_sheet(table);

        ws['!merges']=[{ 
            s: { 
                r: 0, 
                c: 0
            }, 
            e: {
                r: 0, 
                c: table[1].length-1
            } 
        }]

        XLSX.utils.book_append_sheet(wb, ws, '管理员表');

        table = [
            ['负责人表'],
            ['序号','学号/工号','姓名','电话号码','校区','类别']
        ]

        re = await execSQL("select * from user,rp where user.phoneNumber=rp.phoneNumber")

        for(let i=0;i<re.length;i++){
            let currentLine = [i+1]
            let currentUser = re[i]
            currentLine.push(currentUser.account)
            currentLine.push(currentUser.name)
            currentLine.push(currentUser.phoneNumber)
            currentLine.push(currentUser.XQ)
            currentLine.push(currentUser.LX)
            table.push(currentLine)
        }

        ws = XLSX.utils.aoa_to_sheet(table);

        ws['!merges']=[{ 
            s: { 
                r: 0, 
                c: 0
            }, 
            e: {
                r: 0, 
                c: table[1].length-1
            } 
        }]

        XLSX.utils.book_append_sheet(wb, ws, '负责人表');

        table = [
            ['审核人表'],
            ['序号','学号/工号','姓名','电话号码','校区','类别']
        ]

        re = await execSQL("select * from user,rep where user.phoneNumber=rep.phoneNumber")

        for(let i=0;i<re.length;i++){
            let currentLine = [i+1]
            let currentUser = re[i]
            currentLine.push(currentUser.account)
            currentLine.push(currentUser.name)
            currentLine.push(currentUser.phoneNumber)
            currentLine.push(currentUser.XQ)
            currentLine.push(currentUser.LX)
            table.push(currentLine)
        }

        ws = XLSX.utils.aoa_to_sheet(table);

        ws['!merges']=[{ 
            s: { 
                r: 0, 
                c: 0
            }, 
            e: {
                r: 0, 
                c: table[1].length-1
            } 
        }]

        XLSX.utils.book_append_sheet(wb, ws, '审核人表');


        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
            
        const fileName = '巡查速办导出人员信息表.xlsx';

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        // res.setHeader('Content-Disposition', 'attachment; filename=' + fileName);
            
        res.send(excelBuffer);
    }
}