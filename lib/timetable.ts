export type TimetableEntry = {
  id:string; weekday:number; start_period:number; end_period:number;
  subject:string; room:string; teacher:string; color:string;
};
export type TimetableForm = {
  id:string|null; weekday:number; startPeriod:number; endPeriod:number;
  subject:string; room:string; teacher:string; color:string;
};
export const WEEKDAYS = ["월","화","수","목","금"];
export const PERIODS = [1,2,3,4,5,6,7,8];
export const TIMETABLE_COLORS = [
 "#DBEAFE","#FCE7F3","#D1FAE5","#FEF3C7",
 "#EDE9FE","#FFEDD5","#CFFAFE","#E5E7EB",
] as const;
export function newTimetableForm(day=1,period=1):TimetableForm{
  return {id:null,weekday:day,startPeriod:period,endPeriod:period,subject:"",room:"",teacher:"",color:TIMETABLE_COLORS[0]};
}
