xóa mail peding/processing dư thừa (outdated)

sửa format mail cho đẹp
sửa nghiệp vụ leave
xem xét mail khi cancelled request

thêm export
thực hiện ot module
hoàn thành settings module
CẤU HÌNH 
thêm phân trang cho user, leaverequest.
sửa lại logic tính leave balance
làm upload filed

// bổ sung cho leave request

làm trên 5 năm +1 annual paid leave
nghỉ social thì trừ công theo tháng 


create leave request:
nhaapj thoong tin
-> nhap startdate: auto caculate endate, auto caculate range;
-> submit: check trung lap
tinh quy nghi dua tren start, endate (các case qua năm mới, qua tháng mới,...)
split theo quy nghi
-> confirm: tạo leave request, leave request items, balance transaction


M: POLICY LEAVE + SOCIAL_BENEFIT LEAVE - NGHỈ ĐẺ NỮ
P: PAID LEAVE
UP: UNPAID LEAVE

29 30 31 || 1 2 3 
M  P  UP    P UP UP

29 CÒN LẠI: 30 31 1 2 3 => SPLIT 30 31 || 1 2 3 => TÍNH QUỸ NGHỈ THEO THÁNG (PAID, UNPAID) 30 31    => 1  2
M                                                                                           P UP       P  UP
  
ANNUAL: 29 30 31 || 1 2 3
        P UP  UP    P UP UP

SOCIAL_BENEFIT LEAVE



1 request: 
step:
CHIA THEO NĂM, CHIA THEO THÁNG THÀNH CÁC BUCKET SAU ĐÓ XEM LOẠI NGHỈ, XEM CHÍNH SÁCH CỦA LOẠI NGHỈ ĐÓ, QUỸ NGHỈ CỦA LOẠI NGHỈ ĐÓ TRONG BUCKET ĐÓ VÀ CONVERT TRONG BUCKET ĐÓ, NHẢY SANG BUCKET KHÁC THÌ CẬP NHẬP LẠI


connection pool

phân trang cusor , limit offset

locking trong db tránh 2 transaction
 sửa cách viết migration
 index db (đánh đổi)
 xóa checkdto thừa
 xóa nodemodule thừa bên ngoài
 tối ưu truy vấn db
lưu activation mail vào email queue


