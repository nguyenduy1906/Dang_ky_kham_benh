export const encounterStatusLabels = Object.freeze({HOLDING:'Chờ thanh toán',CONFIRMED:'Đã thanh toán',CHECKED_IN:'Đã check in',IN_PROGRESS:'Đang khám',COMPLETED:'Hoàn thành',CANCELLED:'Đã hủy',NO_SHOW:'Không đến',EXPIRED:'Hết hạn'});
export const encounterStatusBadge = value => `<span class="badge encounter-status" data-encounter-status="${value}">${encounterStatusLabels[value]}</span>`;
