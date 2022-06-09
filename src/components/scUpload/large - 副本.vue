<template>
	<div class="sc-upload-file">
		<el-upload
			:disabled="disabled"
			:auto-upload="autoUpload"
			:action="action"
			:name="name"
			:data="data"
			:http-request="request"
			:file-list="defaultFileList"
			:show-file-list="showFileList"
			:drag="drag"
			:accept="accept"
			:multiple="multiple"
			:limit="limit"
			:on-change="change"
			:before-upload="before"
			:on-success="success"
			:on-error="error"
			:on-preview="handlePreview"
			:on-exceed="handleExceed">
			<slot>
				<el-button type="primary" :disabled="disabled">Click to upload</el-button>
			</slot>
			<template #tip>
				<div v-if="tip" class="el-upload__tip">{{tip}}</div>
			</template>
		</el-upload>
		<span style="display:none!important"><el-input v-model="value"></el-input></span>
		<div>
			<p>{{defaultFileList}}</p>
			<el-table :data="defaultFileList" border>
				<el-table-column prop="name" label="文件名" width="180" />
				<el-table-column prop="status" label="状态" width="180" />
				<el-table-column prop="percentage" label="上传进度" min-width="180">
					<template #default="scope">
						<el-progress :percentage="scope.row.percentage" :text-inside="true" :stroke-width="16"/>
					</template>
				</el-table-column>
			</el-table>
		</div>
		<el-dialog v-model="uploaddialog" title="上传" :width="600" destroy-on-close>
			<div v-for="file in files" :key="file.uid">
				<h4>{{file.name}}</h4>
				<p>{{file.percentage}}</p>
				<p><el-progress :percentage="file.percentage" :text-inside="true" :stroke-width="16"/></p>
				<p>{{file.status}}</p>
			</div>
		</el-dialog>
	</div>
</template>

<script>
	import config from "@/config/upload"

	export default {
		props: {
			modelValue: { type: String, default: "" },
			tip: { type: String, default: "" },
			action: { type: String, default: "" },
			apiObj: { type: Object, default: () => {} },
			name: { type: String, default: config.filename },
			data: { type: Object, default: () => {} },
			accept: { type: String, default: "" },
			maxSize: { type: Number, default: config.maxSizeFile },
			limit: { type: Number, default: 0 },
			autoUpload: { type: Boolean, default: true },
			showFileList: { type: Boolean, default: true },
			drag: { type: Boolean, default: false },
			multiple: { type: Boolean, default: true },
			disabled: { type: Boolean, default: false },
			onSuccess: { type: Function, default: () => { return true } }
		},
		data() {
			return {
				value: "",
				defaultFileList: [],
				files: [],
				uploaddialog: false
			}
		},
		watch:{
			modelValue(val){
				if (val != this.toStr(this.defaultFileList)) {
					this.defaultFileList = this.toArr(val)
					this.value = val
				}
			},
			defaultFileList: {
				handler(val){
					this.$emit('update:modelValue', this.toStr(val))
					this.value = this.toStr(val)
				},
				deep: true
			}
		},
		mounted() {
			this.value = this.modelValue
			this.defaultFileList = this.toArr(this.modelValue)
		},
		methods: {
			//默认值转换为数组
			toArr(str){
				var _arr = [];
				var arr = str.split(",");
				arr.forEach(item => {
					if(item){
						var urlArr = item.split('/');
						var fileName = urlArr[urlArr.length - 1]
						_arr.push({
							name: fileName,
							url: item
						})
					}
				})
				return _arr;
			},
			//数组转换为原始值
			toStr(arr){
				return arr.map(v => v.url).join(",")
			},
			//字节转换大小
			formatBytes(size, decimal=2){
				if(size==0 || !size){
					return ""
				}
				const m = 1024
				const n = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
				const f = Math.floor(Math.log(size) / Math.log(m))
				return parseFloat((size / Math.pow(m, f)).toFixed(decimal)) + ' ' + n[f]
			},
			change(){
				// if(file.status == "ready"){
				// 	this.files = []
				// 	this.$nextTick(()=>{
				// 		this.files.push(file)
				// 		this.uploaddialog = true
				// 	})

				// }
			},
			before(file){
				const maxSize = file.size / 1024 / 1024 < this.maxSize;
				if (!maxSize) {
					this.$message.warning(`上传文件大小不能超过 ${this.maxSize}MB!`);
					return false;
				}
			},
			success(res, file){
				var os = this.onSuccess(res, file)
				if(os!=undefined && os==false){
					return false
				}
				var response = config.parseData(res)
				file.name = response.fileName
				file.url = response.src
			},
			error(err){
				this.$notify.error({
					title: '上传文件未成功',
					message: err
				})
			},
			beforeRemove(uploadFile){
				return this.$confirm(`是否移除 ${uploadFile.name} ?`, '提示', {
					type: 'warning',
				}).then(() => {
					return true
				}).catch(() => {
					return false
				})
			},
			handleExceed(){
				this.$message.warning(`当前设置最多上传 ${this.limit} 个文件，请移除后上传!`)
			},
			handlePreview(uploadFile){
				window.open(uploadFile.url)
			},
			request(param){

				console.log(param)
				const chunkSize = 0.5 * 1024 * 1024
				//获取上传的文件
				const file = param.file
				//获取上传的文件的大小
				const fileSize = param.file.size
				//计算当前选择文件需要的分片数量
				const chunkCount = Math.ceil(fileSize / chunkSize)
				console.log("文件大小：", fileSize, "分片数：", chunkCount)
				//获取文件md5
				//调用接口文件md5是否存在

				//文件分片
				const fileChunkList = []
				for (var i = 0; i < chunkCount; i++) {
					let start = i * chunkSize
					let end = Math.min(fileSize, start + chunkSize)
					const chunk = file.slice(start, end)
					fileChunkList.push({
						sizt: chunk.size,
						loaded: 0,
						chunk: chunk
					})
				}

				//计算总进度
				const totalPercentage_computed = () => {
					//console.log(fileChunkList.map(item => item.loaded),file.size)
					const allLoaded = fileChunkList.map(item => item.loaded).reduce((curr, next) => curr + next)
					return parseInt(((allLoaded / file.size) * 100) | 0, 10)
					// const allpercentage = fileChunkList.map(item => item.percentage).reduce((curr, next) => curr + next)
					// return allpercentage/chunkCount
					//return parseInt(((loaded / file.size) * 100) | 0, 10)
				}

				// 循环调用上传，i为开始上传的分片序号，由接口根据文件MD5返回
				const requests = fileChunkList.map((item, index) => {
					//创建表单对象
					let formdata = new FormData()
					formdata.append('totalFileChunk', chunkCount)
					formdata.append('fileChunk', index)
					formdata.append('fileMD5', "MD5")
					formdata.append('file', item.chunk)
					return config.apiObjFile.post(formdata, {
						onUploadProgress: e => {
							item.loaded = e.loaded
							param.onProgress({percent: totalPercentage_computed()})
						}
					})
				})

				Promise.all(requests).then(res => {
					//请求合并接口 合并文件 返回最终文件路径
					param.onSuccess(res[0])
				}).catch(err => {
					param.onError(err)
				})



				// var apiObj = config.apiObjFile;
				// if(this.apiObj){
				// 	apiObj = this.apiObj;
				// }
				// const data = new FormData();
				// data.append(param.filename, param.file);
				// for (const key in param.data) {
				// 	data.append(key, param.data[key]);
				// }
				// apiObj.post(data, {
				// 	onUploadProgress: e => {
				// 		const complete = parseInt(((e.loaded / e.total) * 100) | 0, 10)
				// 		const onUpload = {
				// 			total: e.total,
				// 			loaded: e.loaded
				// 		}
				// 		param.onProgress({percent: complete}, {onUpload: onUpload})
				// 	}
				// }).then(res => {
				// 	var response = config.parseData(res);
				// 	if(response.code == config.successCode){
				// 		param.onSuccess(res)
				// 	}else{
				// 		param.onError(response.msg || "未知错误")
				// 	}
				// }).catch(err => {
				// 	param.onError(err)
				// })
			}
		}
	}
</script>

<style scoped>
	.el-form-item.is-error .sc-upload-file:deep(.el-upload-dragger) {border-color: var(--el-color-danger);}
	.sc-upload-file {width: 100%;}
	.sc-upload-file:deep(.el-upload-list__item) {transition: none !important;}
</style>
