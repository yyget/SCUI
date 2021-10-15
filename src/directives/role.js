import { rolePermission } from '@/utils/permission'

export default {
	mounted(el, binding) {
		const { value } = binding
		((Array.isArray(value) && !value.some(rolePermission)) || !rolePermission(value)) && el.parentNode.removeChild(el);
	}
};
