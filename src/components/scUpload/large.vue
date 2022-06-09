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
	</div>
</template>

<script>
	import config from "@/config/upload"
	import SparkMD5 from './spark-md5'

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
				defaultFileList: []
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
			getFileMD5(file){
				return new Promise((resolve, reject) => {
					const spark = new SparkMD5.ArrayBuffer()
					const fileReader = new FileReader()
					fileReader.onload = e => {
						spark.append(e.target.result)
						resolve(spark.end())
					}
					fileReader.onerror = e => {
						reject(e)
					}
					fileReader.readAsArrayBuffer(file)
				})
			},
			async upFile(param){
				const file = param.file
				//计算文件MD5
				const fileHash = await this.getFileMD5(file)
				//模拟 根据MD5请求接口返回结果
				const res = {
					code: 200,
					data: {
						state: 0,	//0 没有任何分片 1 有部分分片，续传  2存在文件，秒传
						fileUploadedNumber: [],	//如果有部分分片，返回已上传的分片序号
						fileUrl: ""	//如果状态为2 存在文件 返回路径
					}
				}
				if(res.data.state==2){
					//秒传成功
					return false
				}

				//开始切片
				const chunkSize = 0.5 * 1024 * 1024
				//获取上传的文件的大小
				const fileSize = file.size
				//计算当前选择文件需要的分片数量
				const chunkCount = Math.ceil(fileSize / chunkSize)
				console.log("文件大小：", fileSize, "分片数：", chunkCount)

				const fileChunkList = []
				for (var i = 0; i < chunkCount; i++) {
					let start = i * chunkSize
					let end = Math.min(fileSize, start + chunkSize)
					const chunk = file.slice(start, end)
					fileChunkList.push({
						chunkIndex: i + 1,
						size: chunk.size,
						loaded: 0,
						chunk: chunk
					})
				}

				//计算总进度
				const totalPercentage_computed = ()=> {
					const allLoaded = fileChunkList.map(item => item.loaded).reduce((curr, next) => curr + next)
					const computed = parseInt(((allLoaded / file.size) * 100) | 0, 10)
					param.onProgress({percent: computed})
				}

				//遍历上传，过滤掉已上传的分片
				const requests = fileChunkList.filter((item, index) => !res.data.fileUploadedNumber.includes(index+1)).map(item => {
					let formdata = new FormData()
					formdata.append('totalFileChunk', chunkCount)
					formdata.append('chunkIndex', item.chunkIndex)
					formdata.append('fileHash', fileHash)
					formdata.append('file', item.chunk)
					return config.apiObjFile.post(formdata, {
						onUploadProgress: e => {
							item.loaded = e.loaded
							totalPercentage_computed()
						}
					})
				})

				Promise.all(requests).then(res => {
					param.onSuccess(res[0])
					//请求合并接口 合并文件 返回最终文件路径
				}).catch(err => {
					param.onError(err)
				})
			},
			request(param){
				this.upFile(param)
			}
		}
	}
</script>

<style scoped>
	.el-form-item.is-error .sc-upload-file:deep(.el-upload-dragger) {border-color: var(--el-color-danger);}
	.sc-upload-file {width: 100%;}
	.sc-upload-file:deep(.el-upload-list__item) {transition: none !important;}
</style>
